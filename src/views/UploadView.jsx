import { useState, useRef } from 'react';
import { detectCRSFromText, fetchCRSDefinition, getCrsCode, searchCRSCatalog } from '../services/crsService';
import { t as translate } from '../i18n';

function detectFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { geojson: 'GeoJSON', json: 'JSON/GeoJSON', kml: 'KML', gpkg: 'GeoPackage', shp: 'Shapefile', tif: 'GeoTIFF', tiff: 'GeoTIFF', csv: 'CSV', zip: 'ZIP', prj: 'Projection', png: 'PNG', jpg: 'JPEG', jpeg: 'JPEG', webp: 'WEBP' };
  return map[ext] || ext.toUpperCase();
}

const VECTOR_SUPPORTED = ['geojson', 'json', 'kml'];
const RASTER_SUPPORTED = ['png', 'jpg', 'jpeg', 'webp'];
function extensionOf(filename = '') { return filename.split('.').pop().toLowerCase(); }
function isVectorSupported(filename) { return VECTOR_SUPPORTED.includes(extensionOf(filename)); }
function isRasterSupported(filename) { return RASTER_SUPPORTED.includes(extensionOf(filename)); }

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
    const point = pm.querySelector('Point coordinates');
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = () => reject(new Error('UNABLE_READ_FILE'));
    reader.readAsDataURL(file);
  });
}

function normalizeWmsUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('SERVICE');
    u.searchParams.delete('service');
    u.searchParams.delete('REQUEST');
    u.searchParams.delete('request');
    return u.toString();
  } catch {
    return url;
  }
}

export default function UploadView({ language = 'it', setLayers, setCollectedPoints, setSelectedLayerId, setActiveTab, projectCrs = 'EPSG:4326' }) {
  const tt = (key) => translate(language, key);
  const fileInputRef = useRef(null);
  const [importMode, setImportMode] = useState('vector');
  const [pickedFile, setPickedFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const [manualCrs, setManualCrs] = useState('');
  const [crsSuggestions, setCrsSuggestions] = useState([]);
  const [rasterBounds, setRasterBounds] = useState({ south: '', west: '', north: '', east: '' });
  const [wms, setWms] = useState({ url: '', layerName: '', displayName: '', format: 'image/png', transparent: true });
  const [wmsLayers, setWmsLayers] = useState([]);
  const [readingWms, setReadingWms] = useState(false);

  const accept = importMode === 'raster' ? '.png,.jpg,.jpeg,.webp,.tif,.tiff' : '.geojson,.json,.kml,.prj,.gpkg,.shp,.csv,.zip';

  const handleFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setStatus(null);

    if (importMode === 'raster') {
      const main = files.find(f => isRasterSupported(f.name));
      if (!main) {
        const first = files[0];
        setPickedFile({ name: first.name, size: first.size, format: detectFormat(first.name), dataUrl: null, detectedCrs: 'EPSG:4326' });
        setStatus({ type: 'warn', msg: language === 'en' ? 'Only PNG, JPG and WEBP rasters can be displayed directly in the browser. GeoTIFF needs a dedicated parser or backend.' : 'Solo raster PNG, JPG e WEBP sono visualizzabili direttamente nel browser. GeoTIFF richiede parser dedicato o backend.' });
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(main);
        setPickedFile({ name: main.name, size: main.size, format: detectFormat(main.name), dataUrl, detectedCrs: 'EPSG:4326' });
      } catch (err) {
        setStatus({ type: 'error', msg: localizeImportError(err, tt) });
      }
      return;
    }

    const main = files.find(f => isVectorSupported(f.name));
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

  const readWmsCapabilities = async () => {
    if (!wms.url.trim()) { setStatus({ type: 'error', msg: language === 'en' ? 'Enter the WMS URL first.' : 'Inserisci prima l’URL WMS.' }); return; }
    setReadingWms(true);
    setStatus(null);
    try {
      const base = normalizeWmsUrl(wms.url.trim());
      const sep = base.includes('?') ? '&' : '?';
      const res = await fetch(`${base}${sep}SERVICE=WMS&REQUEST=GetCapabilities`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const layers = Array.from(doc.querySelectorAll('Layer > Name')).map(n => {
        const parent = n.parentElement;
        return { name: n.textContent.trim(), title: parent?.querySelector('Title')?.textContent?.trim() || n.textContent.trim() };
      }).filter(l => l.name);
      setWmsLayers(layers);
      if (layers[0]) setWms(prev => ({ ...prev, layerName: prev.layerName || layers[0].name, displayName: prev.displayName || layers[0].title }));
      setStatus({ type: 'success', msg: language === 'en' ? `Found ${layers.length} WMS layers.` : `Trovati ${layers.length} layer WMS.` });
    } catch (err) {
      setStatus({ type: 'error', msg: language === 'en' ? `Unable to read WMS capabilities: ${err.message}` : `Impossibile leggere i layer WMS: ${err.message}` });
    } finally {
      setReadingWms(false);
    }
  };

  const addWmsLayer = () => {
    if (!wms.url.trim() || !wms.layerName.trim()) { setStatus({ type: 'error', msg: language === 'en' ? 'WMS URL and technical layer name are required.' : 'URL WMS e nome tecnico layer sono obbligatori.' }); return; }
    const id = Date.now();
    const newLayer = {
      id,
      name: wms.displayName.trim() || wms.layerName.trim(),
      type: 'WMS',
      active: true,
      colorHex: '#38bdf8',
      crs: projectCrs,
      serviceType: 'wms',
      url: normalizeWmsUrl(wms.url.trim()),
      layers: wms.layerName.trim(),
      format: wms.format,
      transparent: wms.transparent,
      opacity: 0.85,
      fields: [],
      symbology: { mode: 'single', attribute: null, rules: [] }
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(id);
    setStatus({ type: 'success', msg: language === 'en' ? `WMS layer "${newLayer.name}" added.` : `Layer WMS "${newLayer.name}" aggiunto.` });
    setTimeout(() => setActiveTab('explore'), 600);
  };

  const addRasterLayer = () => {
    if (!pickedFile?.dataUrl) { setStatus({ type: 'error', msg: tt('selectFileFirst') }); return; }
    const nums = Object.fromEntries(Object.entries(rasterBounds).map(([k, v]) => [k, Number(v)]));
    if (![nums.south, nums.west, nums.north, nums.east].every(Number.isFinite) || nums.south >= nums.north || nums.west >= nums.east) {
      setStatus({ type: 'error', msg: language === 'en' ? 'Enter valid bounds: south/west/north/east in WGS84.' : 'Inserisci limiti validi: sud/ovest/nord/est in WGS84.' });
      return;
    }
    const id = Date.now();
    const layerName = pickedFile.name.replace(/\.[^.]+$/, '');
    const newLayer = {
      id,
      name: layerName,
      type: 'Raster',
      active: true,
      colorHex: '#a78bfa',
      crs: 'EPSG:4326',
      serviceType: 'raster',
      url: pickedFile.dataUrl,
      bounds: [[nums.south, nums.west], [nums.north, nums.east]],
      opacity: 0.85,
      fields: [],
      symbology: { mode: 'single', attribute: null, rules: [] }
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(id);
    setStatus({ type: 'success', msg: language === 'en' ? `Raster layer "${layerName}" added.` : `Layer raster "${layerName}" aggiunto.` });
    setTimeout(() => setActiveTab('explore'), 600);
  };

  const handleImportVector = async () => {
    if (!pickedFile) { setStatus({ type: 'error', msg: tt('selectFileFirst') }); return; }
    if (!pickedFile.text) { setStatus({ type: 'error', msg: tt('unsupportedImportFormat') }); return; }
    setImporting(true);
    setStatus(null);
    try {
      const ext = extensionOf(pickedFile.name);
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
      setStatus({ type: 'success', msg: language === 'en' ? `Imported ${features.length} features into layer "${layerName}".` : `Importate ${features.length} feature nel layer "${layerName}".` });
      setTimeout(() => setActiveTab('explore'), 900);
    } catch (err) {
      setStatus({ type: 'error', msg: localizeImportError(err, tt) });
    } finally {
      setImporting(false);
    }
  };

  const statusColors = { error: 'text-red-400 bg-red-400/10 border-red-400/20', warn: 'text-amber-400 bg-amber-400/10 border-amber-400/20', success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  const modeButton = (id, title, subtitle) => (
    <button onClick={() => { setImportMode(id); setPickedFile(null); setStatus(null); }} className={`flex-1 min-w-[8rem] p-4 rounded-2xl border text-left transition-all ${importMode === id ? 'bg-primary/15 border-primary text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`}>
      <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-[9px] mt-1 leading-relaxed">{subtitle}</p>
    </button>
  );

  return (
    <div className="w-full max-w-3xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center"><h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">{tt('importFile')}</h2></div>
      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="p-5 sm:p-8 flex flex-col gap-4 border-b border-white/5">
          <div className="flex flex-wrap gap-3">
            {modeButton('vector', language === 'en' ? 'Vector' : 'Vettore', 'GeoJSON / KML')}
            {modeButton('raster', 'Raster', 'PNG / JPG / WEBP')}
            {modeButton('wms', 'WMS', 'OGC Web Map Service')}
          </div>
        </div>

        {importMode !== 'wms' && (
          <div className="p-6 sm:p-8 flex flex-col items-center gap-5 border-b border-white/5">
            <button onClick={() => fileInputRef.current?.click()} className="w-full max-w-md flex flex-col items-center gap-4 p-8 sm:p-10 rounded-[2rem] border-2 border-dashed border-white/15 hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></div>
              <div className="text-center"><p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{tt('tapToSelectData')}</p><p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{importMode === 'raster' ? 'PNG · JPG · WEBP' : tt('supportedFormatsShort')}</p></div>
            </button>
            <input ref={fileInputRef} type="file" multiple accept={accept} onChange={handleFilePick} className="hidden" />
            {pickedFile && (
              <div className="w-full max-w-md p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${(importMode === 'raster' ? isRasterSupported(pickedFile.name) : isVectorSupported(pickedFile.name)) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{pickedFile.format.slice(0, 4)}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{pickedFile.name}</p><p className="text-[10px] text-slate-500 mt-0.5">{pickedFile.format} · {formatBytes(pickedFile.size)} · CRS {pickedFile.detectedCrs || tt('unknown').toLowerCase()}</p></div>
                <button onClick={() => { setPickedFile(null); setStatus(null); }} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors flex items-center justify-center">×</button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5">
          {importMode === 'vector' && (
            <>
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
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5"><p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{tt('browserSupport')}</p><ul className="space-y-1 text-[10px] text-slate-400"><li>{tt('geojsonSupport')}</li><li>{tt('kmlSupport')}</li><li>{tt('prjSupport')}</li><li>{tt('unsupportedDesktopFormats')}</li></ul></div>
            </>
          )}

          {importMode === 'raster' && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">{language === 'en' ? 'Raster bounds (WGS84)' : 'Estensione raster (WGS84)'}</p>
              <div className="grid grid-cols-2 gap-3">
                {['south', 'west', 'north', 'east'].map(k => <input key={k} value={rasterBounds[k]} onChange={e => setRasterBounds(prev => ({ ...prev, [k]: e.target.value }))} placeholder={language === 'en' ? k : ({ south: 'sud', west: 'ovest', north: 'nord', east: 'est' }[k])} inputMode="decimal" className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />)}
              </div>
              <p className="text-[9px] text-slate-500">{language === 'en' ? 'Local image rasters need a geographic bounding box to be positioned on the map.' : 'I raster immagine locali richiedono un riquadro geografico per essere posizionati sulla mappa.'}</p>
            </div>
          )}

          {importMode === 'wms' && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">WMS</p>
              <input value={wms.url} onChange={e => setWms(prev => ({ ...prev, url: e.target.value }))} placeholder="https://.../wms" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <button onClick={readWmsCapabilities} disabled={readingWms} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-40">{readingWms ? (language === 'en' ? 'Reading...' : 'Lettura...') : (language === 'en' ? 'Read WMS layers' : 'Leggi layer WMS')}</button>
              {wmsLayers.length > 0 && <select value={wms.layerName} onChange={e => { const item = wmsLayers.find(l => l.name === e.target.value); setWms(prev => ({ ...prev, layerName: e.target.value, displayName: item?.title || prev.displayName })); }} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary">{wmsLayers.map(l => <option key={l.name} value={l.name} className="bg-[#0f172a] text-white">{l.title} — {l.name}</option>)}</select>}
              <input value={wms.layerName} onChange={e => setWms(prev => ({ ...prev, layerName: e.target.value }))} placeholder={language === 'en' ? 'Technical layer name' : 'Nome tecnico layer'} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <input value={wms.displayName} onChange={e => setWms(prev => ({ ...prev, displayName: e.target.value }))} placeholder={language === 'en' ? 'Display name (optional)' : 'Nome visualizzato (opzionale)'} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={wms.transparent} onChange={e => setWms(prev => ({ ...prev, transparent: e.target.checked }))} /> Transparent PNG</label>
            </div>
          )}

          {status && <div className={`p-4 rounded-2xl border text-xs ${statusColors[status.type]}`}>{status.msg}</div>}
        </div>
        <div className="px-6 sm:px-10 py-5 border-t border-white/5 bg-black/20 flex justify-between items-center"><button onClick={() => setActiveTab('explore')} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">{tt('cancel')}</button><button onClick={importMode === 'wms' ? addWmsLayer : importMode === 'raster' ? addRasterLayer : handleImportVector} disabled={importing} className="px-8 sm:px-10 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs disabled:opacity-40 disabled:cursor-not-allowed">{importing ? tt('importing') : tt('importLayer')}</button></div>
      </div>
    </div>
  );
}
