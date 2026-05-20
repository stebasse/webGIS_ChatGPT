import { useState, useRef } from 'react';
import { detectCRSFromText, fetchCRSDefinition, getCrsCode, searchCRSCatalog } from '../services/crsService';
import { t as translate } from '../i18n';

function detectFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { geojson: 'GeoJSON', json: 'JSON/GeoJSON', kml: 'KML', gpkg: 'GeoPackage', shp: 'Shapefile', tif: 'GeoTIFF', tiff: 'GeoTIFF', csv: 'CSV', zip: 'ZIP', prj: 'Projection' };
  return map[ext] || ext.toUpperCase();
}

const BROWSER_SUPPORTED = ['geojson', 'json', 'kml'];
function isSupported(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return BROWSER_SUPPORTED.includes(ext);
}

function parseGeoJSON(text, layerId, layerName, sourceCrs) {
  const data = JSON.parse(text);
  const embeddedCrs = data.crs?.properties?.name || data.crs?.name || detectCRSFromText(JSON.stringify(data.crs || {}));
  const crs = getCrsCode(embeddedCrs || sourceCrs || 'EPSG:4326');
  if (data.type === 'FeatureCollection') {
    return {
      crs,
      features: data.features.map((f, i) => ({
        ...f,
        properties: { ...f.properties, id: Date.now() + i, layerId, layerName, timestamp: new Date().toISOString(), source: 'import', sourceCrs: crs }
      }))
    };
  }
  if (data.type === 'Feature') {
    return { crs, features: [{ ...data, properties: { ...data.properties, id: Date.now(), layerId, layerName, timestamp: new Date().toISOString(), source: 'import', sourceCrs: crs } }] };
  }
  throw new Error('INVALID_GEOJSON');
}

function parseKML(text, layerId, layerName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('INVALID_KML: ' + parseError.textContent.slice(0, 100));

  const features = [];
  let idCounter = Date.now();
  const sourceCrs = 'EPSG:4326';
  doc.querySelectorAll('Placemark').forEach(pm => {
    const name = pm.querySelector('name')?.textContent || '';
    const desc = pm.querySelector('description')?.textContent || '';
    const props = { id: idCounter++, layerId, layerName, name, description: desc, timestamp: new Date().toISOString(), source: 'import', sourceCrs };
    const point = pm.querySelector('Coordinate punto');
    if (point) {
      const [lon, lat, alt = 0] = point.textContent.trim().split(',').map(Number);
      features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [lon, lat, alt] } });
    }
    const lineCoords = pm.querySelector('LineString coordinates');
    if (lineCoords) {
      const coords = lineCoords.textContent.trim().split(/\s+/).map(c => c.split(',').map(Number).slice(0, 2));
      features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } });
    }
    const polyCoords = pm.querySelector('Polygon outerBoundaryIs coordinates');
    if (polyCoords) {
      const coords = polyCoords.textContent.trim().split(/\s+/).map(c => c.split(',').map(Number).slice(0, 2));
      features.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [coords] } });
    }
  });
  if (features.length === 0) throw new Error('NO_KML_GEOMETRY');
  return { crs: sourceCrs, features };
}

function inferGeomType(features) {
  const types = new Set(features.map(f => f.geometry?.type).filter(Boolean));
  if (types.size === 1) {
    const t = [...types][0];
    if (t === 'Point' || t === 'MultiPoint') return 'Point';
    if (t === 'LineString' || t === 'MultiLineString') return 'Line';
    if (t === 'Polygon' || t === 'MultiPolygon') return 'Polygon';
  }
  return 'Mixed';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}


function localizeImportError(err, tt) {
  const message = String(err?.message || err || '');
  if (message === 'INVALID_GEOJSON') return tt('invalidGeoJson');
  if (message.startsWith('INVALID_KML:')) return `${tt('invalidKml')} ${message.replace('INVALID_KML:', '').trim()}`;
  if (message === 'NO_KML_GEOMETRY') return tt('noGeometryInKml');
  if (message === 'UNABLE_READ_FILE') return tt('unableReadFile');
  return message;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('UNABLE_READ_FILE')); 
    reader.readAsText(file);
  });
}

export default function UploadView({ language = 'it', layers, setLayers, setCollectedPoints, setSelectedLayerId, setActiveTab, projectCrs = 'EPSG:4326' }) {
  const tt = (key) => translate(language, key);
  const fileInputRef = useRef(null);
  const [pickedFile, setPickedFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const [manualCrs, setManualCrs] = useState('');
  const [crsSuggestions, setCrsSuggestions] = useState([]);
  const [importKind, setImportKind] = useState('vector');
  const [wmsUrl, setWmsUrl] = useState('');
  const [wmsLayerName, setWmsLayerName] = useState('');
  const [wmsDisplayName, setWmsDisplayName] = useState('');
  const [wmsCapabilities, setWmsCapabilities] = useState([]);

  const handleFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setStatus(null);

    const main = files.find(f => isSupported(f.name));
    const prj = files.find(f => f.name.toLowerCase().endsWith('.prj'));
    if (!main) {
      const first = files[0];
      setPickedFile({ name: first.name, size: first.size, format: detectFormat(first.name), text: null, detectedCrs: null });
      setStatus({ type: 'warn', msg: tt('unsupportedImportFormat') });
      return;
    }

    try {
      const [mainText, prjText] = await Promise.all([readFileAsText(main), prj ? readFileAsText(prj) : Promise.resolve('')]);
      const embedded = main.name.toLowerCase().endsWith('.kml') ? 'EPSG:4326' : detectCRSFromText(mainText);
      const prjCrs = detectCRSFromText(prjText);
      const detectedCrs = getCrsCode(prjCrs || embedded || manualCrs || 'EPSG:4326');
      if (detectedCrs) await fetchCRSDefinition(detectedCrs);
      setPickedFile({ name: main.name, size: main.size, format: detectFormat(main.name), text: mainText, prjText, detectedCrs });
      setManualCrs(detectedCrs);
      if (!prjCrs && !embedded) setStatus({ type: 'warn', msg: tt('crsNotDetected') });
    } catch (err) {
      setStatus({ type: 'error', msg: localizeImportError(err, tt) });
    }
  };

  const updateManualCrs = async (value) => {
    setManualCrs(value);
    if (value.trim().length >= 2) setCrsSuggestions(await searchCRSCatalog(value));
  };

  const normalizeWmsUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed);
      url.searchParams.delete('request');
      url.searchParams.delete('REQUEST');
      url.searchParams.delete('service');
      url.searchParams.delete('SERVICE');
      url.searchParams.delete('version');
      url.searchParams.delete('VERSION');
      return url.toString();
    } catch {
      return trimmed;
    }
  };

  const guessWmsLayerName = (value) => {
    try {
      const url = new URL(value.trim());
      return url.searchParams.get('layers') || url.searchParams.get('LAYERS') || '';
    } catch {
      return '';
    }
  };

  const buildWmsCapabilitiesUrl = (value) => {
    const raw = normalizeWmsUrl(value);
    if (!raw) return '';
    try {
      const url = new URL(raw);
      url.searchParams.set('service', 'WMS');
      url.searchParams.set('request', 'GetCapabilities');
      return url.toString();
    } catch {
      const sep = raw.includes('?') ? '&' : '?';
      return `${raw}${sep}service=WMS&request=GetCapabilities`;
    }
  };

  const parseWmsCapabilities = (xmlText) => {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('INVALID_WMS_CAPABILITIES');
    const serviceTitle = doc.querySelector('Service > Title')?.textContent?.trim() || 'WMS';
    const layersFound = Array.from(doc.querySelectorAll('Capability Layer Layer'))
      .map(node => ({
        name: node.querySelector(':scope > Name')?.textContent?.trim() || '',
        title: node.querySelector(':scope > Title')?.textContent?.trim() || '',
      }))
      .filter(item => item.name);
    return { serviceTitle, layers: layersFound };
  };

  const loadWmsCapabilities = async () => {
    const capabilitiesUrl = buildWmsCapabilitiesUrl(wmsUrl);
    if (!capabilitiesUrl) {
      setStatus({ type: 'error', msg: language === 'en' ? 'Enter a WMS URL first.' : 'Inserisci prima un URL WMS.' });
      return;
    }
    setImporting(true);
    setStatus(null);
    try {
      const res = await fetch(capabilitiesUrl);
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const parsed = parseWmsCapabilities(await res.text());
      setWmsCapabilities(parsed.layers);
      if (!wmsLayerName && parsed.layers[0]?.name) setWmsLayerName(parsed.layers[0].name);
      setStatus({
        type: 'success',
        msg: language === 'en'
          ? `Found ${parsed.layers.length} WMS layers in ${parsed.serviceTitle}. Select one and connect.`
          : `Trovati ${parsed.layers.length} layer WMS in ${parsed.serviceTitle}. Scegline uno e connetti.`
      });
    } catch (err) {
      setWmsCapabilities([]);
      setStatus({
        type: 'warn',
        msg: language === 'en'
          ? 'Unable to read GetCapabilities. If the server blocks browser access, enter the exact technical layer name manually.'
          : 'Impossibile leggere GetCapabilities. Se il server blocca l’accesso dal browser, inserisci manualmente il nome tecnico esatto del layer.'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleWmsImport = async () => {
    const url = normalizeWmsUrl(wmsUrl);
    const layerNameFromUrl = guessWmsLayerName(wmsUrl);
    const technicalLayerName = (wmsLayerName || layerNameFromUrl).trim();
    const layerTitleFromCapabilities = wmsCapabilities.find(item => item.name === technicalLayerName)?.title || '';
    const layerName = (wmsDisplayName || layerTitleFromCapabilities || technicalLayerName || 'WMS layer').trim();
    if (!url) {
      setStatus({ type: 'error', msg: language === 'en' ? 'Enter a valid WMS URL.' : 'Inserisci un URL WMS valido.' });
      return;
    }
    if (!technicalLayerName) {
      setStatus({ type: 'error', msg: language === 'en' ? 'Enter/select the technical WMS layer name. The display name alone is not enough.' : 'Inserisci/seleziona il nome tecnico del layer WMS. Il solo nome visualizzato non basta.' });
      return;
    }
    const layerId = Date.now();
    const newLayer = {
      id: layerId,
      name: layerName,
      type: 'WMS',
      colorHex: '#38bdf8',
      active: true,
      fields: [],
      crs: projectCrs,
      sourceCrs: projectCrs,
      displayCrs: projectCrs,
      format: 'wms',
      formatExt: null,
      dirLabel: null,
      symbology: { mode: 'single', attribute: null, rules: [] },
      wms: {
        url,
        layers: technicalLayerName,
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
      }
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(layerId);
    setStatus({ type: 'success', msg: language === 'en' ? `WMS layer "${layerName}" added.` : `Layer WMS "${layerName}" aggiunto.` });
    setTimeout(() => setActiveTab('explore'), 900);
  };

  const handleImport = async () => {
    if (importKind === 'wms') {
      await handleWmsImport();
      return;
    }
    if (importKind === 'raster') {
      setStatus({ type: 'warn', msg: language === 'en' ? 'Raster import is prepared in the UI. GeoTIFF rendering will be enabled in the next raster engine step.' : 'Import raster predisposto nell’interfaccia. La visualizzazione GeoTIFF sarà abilitata nel prossimo step del motore raster.' });
      return;
    }
    if (!pickedFile) { setStatus({ type: 'error', msg: tt('selectFileFirst') }); return; }
    if (!pickedFile.text) { setStatus({ type: 'error', msg: tt('unsupportedImportFormat') }); return; }
    setImporting(true);
    setStatus(null);
    try {
      const ext = pickedFile.name.split('.').pop().toLowerCase();
      const layerName = pickedFile.name.replace(/\.[^.]+$/, '');
      const layerId = Date.now();
      const sourceCrs = getCrsCode(manualCrs || pickedFile.detectedCrs || 'EPSG:4326');
      await fetchCRSDefinition(sourceCrs);
      let parsed;
      if (ext === 'geojson' || ext === 'json') parsed = parseGeoJSON(pickedFile.text, layerId, layerName, sourceCrs);
      else if (ext === 'kml') parsed = parseKML(pickedFile.text, layerId, layerName);
      const features = parsed.features.map(f => ({ ...f, properties: { ...(f.properties || {}), sourceCrs: parsed.crs || sourceCrs, layerId, layerName } }));
      const geomType = inferGeomType(features);
      const sampleProps = features[0]?.properties || {};
      const autoFields = Object.keys(sampleProps).filter(k => !['id', 'layerId', 'layerName', 'timestamp', 'source', 'sourceCrs'].includes(k)).map(k => ({ name: k, type: 'String', defaultVal: '' }));
      const newLayer = {
        id: layerId,
        name: layerName,
        type: `Vector - ${geomType}`,
        colorHex: '#f97316', active: true,
        fields: [{ name: 'ID', type: 'Integer', defaultVal: 'AUTO_INC' }, ...autoFields],
        crs: parsed.crs || sourceCrs,
        sourceCrs: parsed.crs || sourceCrs,
        displayCrs: projectCrs,
        format: ext === 'kml' ? 'kml' : 'geojson',
        formatExt: ext === 'kml' ? '.kml' : '.geojson',
        dirLabel: null,
        symbology: { mode: 'single', attribute: null, rules: [] }
      };
      setLayers(prev => [...prev, newLayer]);
      setCollectedPoints(prev => [...prev, ...features]);
      setSelectedLayerId(layerId);
      setStatus({ type: 'success', msg: language === 'en' ? `Imported ${features.length} features into layer "${layerName}". Layer CRS: ${newLayer.crs}. Project CRS: ${projectCrs}.` : `Importate ${features.length} feature nel layer "${layerName}". CRS layer: ${newLayer.crs}. CRS progetto: ${projectCrs}.` });
      setTimeout(() => setActiveTab('explore'), 1200);
    } catch (err) {
      setStatus({ type: 'error', msg: localizeImportError(err, tt) });
    } finally {
      setImporting(false);
    }
  };

  const statusColors = { error: 'text-red-400 bg-red-400/10 border-red-400/20', warn: 'text-amber-400 bg-amber-400/10 border-amber-400/20', success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };

  return (
    <div className="app-page app-page-narrow animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center"><h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">{tt('importFile')}</h2></div>
      <div className="app-panel flex-1 w-full glass border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="p-6 sm:p-10 flex flex-col items-center gap-6 border-b border-white/5">
          <div className="w-full max-w-md grid grid-cols-3 gap-2 p-1 rounded-2xl bg-black/20 border border-white/10">
            {[
              { key: 'vector', label: language === 'en' ? 'Vector' : 'Vettore' },
              { key: 'raster', label: 'Raster' },
              { key: 'wms', label: 'WMS' },
            ].map(option => (
              <label key={option.key} className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${importKind === option.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <input type="radio" name="import-kind" value={option.key} checked={importKind === option.key} onChange={() => { setImportKind(option.key); setStatus(null); }} className="sr-only" />
                {option.label}
              </label>
            ))}
          </div>

          {importKind !== 'wms' ? (
            <>
              <button onClick={() => fileInputRef.current?.click()} className="w-full max-w-md flex flex-col items-center gap-4 p-8 sm:p-12 rounded-[2rem] border-2 border-dashed border-white/15 hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></div>
                <div className="text-center"><p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{importKind === 'raster' ? (language === 'en' ? 'Tap to select raster data' : 'Tocca per selezionare dati raster') : tt('tapToSelectData')}</p><p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{importKind === 'raster' ? 'GeoTIFF · TIF · TIFF' : tt('supportedFormatsShort')}</p></div>
              </button>
              <input ref={fileInputRef} type="file" multiple accept={importKind === 'raster' ? '.tif,.tiff' : '.geojson,.json,.kml,.prj,.gpkg,.shp,.csv,.zip'} onChange={handleFilePick} className="hidden" />
              {pickedFile && (
                <div className="w-full max-w-md p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${isSupported(pickedFile.name) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{pickedFile.format.slice(0, 4)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{pickedFile.name}</p><p className="text-[10px] text-slate-500 mt-0.5">{pickedFile.format} · {formatBytes(pickedFile.size)} · CRS {pickedFile.detectedCrs || tt('unknown').toLowerCase()}</p></div>
                  <button onClick={() => { setPickedFile(null); setStatus(null); }} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors flex items-center justify-center">×</button>
                </div>
              )}
            </>
          ) : (
            <div className="w-full max-w-md p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">URL WMS</label>
                <textarea value={wmsUrl} onChange={(e) => { setWmsUrl(e.target.value); setWmsCapabilities([]); }} placeholder="https://.../wms?service=WMS" rows={3} className="w-full bg-black/25 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-primary resize-none" />
              </div>
              <button type="button" onClick={loadWmsCapabilities} disabled={importing || !wmsUrl.trim()} className="w-full px-4 py-3 rounded-2xl border border-primary/30 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
                {language === 'en' ? 'Read WMS layers' : 'Leggi layer WMS'}
              </button>
              {wmsCapabilities.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{language === 'en' ? 'Available layers' : 'Layer disponibili'}</label>
                  <select value={wmsLayerName} onChange={(e) => setWmsLayerName(e.target.value)} className="w-full bg-black/25 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-primary">
                    {wmsCapabilities.map(item => <option key={item.name} value={item.name} className="bg-[#0f172a] text-white">{item.title ? `${item.title} — ${item.name}` : item.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{language === 'en' ? 'Technical layer name' : 'Nome tecnico layer'}</label>
                <input value={wmsLayerName} onChange={(e) => setWmsLayerName(e.target.value)} placeholder={language === 'en' ? 'Required, e.g. namespace:layer' : 'Obbligatorio, es. namespace:layer'} className="w-full bg-black/25 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{language === 'en' ? 'Display name' : 'Nome visualizzato'}</label>
                <input value={wmsDisplayName} onChange={(e) => setWmsDisplayName(e.target.value)} placeholder={language === 'en' ? 'Optional' : 'Opzionale'} className="w-full bg-black/25 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{language === 'en' ? 'A WMS needs both the service URL and the exact technical layer name. Use “Read WMS layers” when the server allows GetCapabilities from the browser.' : 'Un WMS richiede sia l’URL del servizio sia il nome tecnico esatto del layer. Usa “Leggi layer WMS” quando il server permette GetCapabilities dal browser.'}</p>
            </div>
          )}
        </div>

        <div className="flex-1 responsive-panel-scroll custom-scrollbar p-4 sm:p-6 lg:p-8 space-y-5">
          {importKind === 'vector' && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">{tt('layerCrs')}</p>
              <input value={manualCrs} onChange={(e) => updateManualCrs(e.target.value)} placeholder={tt('crsSearchPlaceholder')} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              {crsSuggestions.length > 0 && (
                <select value={manualCrs} onChange={(e) => setManualCrs(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary">
                  {crsSuggestions.map(c => <option key={c.code} value={c.code} className="bg-[#0f172a] text-white">{c.code} — {c.name}</option>)}
                </select>
              )}
              <p className="text-[9px] text-slate-500">{tt('crsImportHelp')}</p>
            </div>
          )}
          <div className="p-4 rounded-2xl bg-black/20 border border-white/5"><p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{tt('browserSupport')}</p><ul className="space-y-1 text-[10px] text-slate-400"><li>{tt('geojsonSupport')}</li><li>{tt('kmlSupport')}</li><li>{tt('prjSupport')}</li><li>{tt('unsupportedDesktopFormats')}</li></ul></div>
          {status && <div className={`p-4 rounded-2xl border text-xs ${statusColors[status.type]}`}>{status.msg}</div>}
        </div>
        <div className="px-6 sm:px-10 py-5 border-t border-white/5 bg-black/20 flex justify-between items-center"><button onClick={() => setActiveTab('explore')} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">{tt('cancel')}</button><button onClick={handleImport} disabled={importing || (importKind === 'vector' && (!pickedFile || !pickedFile.text)) || (importKind === 'wms' && (!wmsUrl.trim() || !(wmsLayerName.trim() || guessWmsLayerName(wmsUrl).trim())))} className="px-10 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs disabled:opacity-40 disabled:cursor-not-allowed">{importing ? tt('importing') : (importKind === 'wms' ? (language === 'en' ? 'Connect WMS' : 'Connetti WMS') : tt('importLayer'))}</button></div>
      </div>
    </div>
  );
}
