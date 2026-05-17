import { useState, useRef } from 'react';

// ── Format detection ──────────────────────────────────────────────────────
function detectFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { geojson: 'GeoJSON', json: 'JSON/GeoJSON', kml: 'KML', gpkg: 'GeoPackage', shp: 'Shapefile', tif: 'GeoTIFF', tiff: 'GeoTIFF', csv: 'CSV', zip: 'ZIP' };
  return map[ext] || ext.toUpperCase();
}

const BROWSER_SUPPORTED = ['geojson', 'json', 'kml'];
function isSupported(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return BROWSER_SUPPORTED.includes(ext);
}

// ── GeoJSON parser ────────────────────────────────────────────────────────
function parseGeoJSON(text, layerId, layerName) {
  const data = JSON.parse(text);
  if (data.type === 'FeatureCollection') {
    return data.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, id: Date.now() + i, layerId, layerName, timestamp: new Date().toISOString(), source: 'import' }
    }));
  }
  if (data.type === 'Feature') {
    return [{ ...data, properties: { ...data.properties, id: Date.now(), layerId, layerName, timestamp: new Date().toISOString(), source: 'import' } }];
  }
  throw new Error('Il file non è un GeoJSON valido (deve essere Feature o FeatureCollection).');
}

// ── KML parser ────────────────────────────────────────────────────────────
function parseKML(text, layerId, layerName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('KML non valido: ' + parseError.textContent.slice(0, 100));

  const features = [];
  let idCounter = Date.now();

  doc.querySelectorAll('Placemark').forEach(pm => {
    const name = pm.querySelector('name')?.textContent || '';
    const desc = pm.querySelector('description')?.textContent || '';
    const props = { id: idCounter++, layerId, layerName, name, description: desc, timestamp: new Date().toISOString(), source: 'import' };

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

  if (features.length === 0) throw new Error('Nessuna geometria trovata nel file KML.');
  return features;
}

// ── Infer geometry type from features ────────────────────────────────────
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

// ── Format size ───────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ─────────────────────────────────────────────────────────────────────────
export default function UploadView({ layers, setLayers, setCollectedPoints, setSelectedLayerId, setActiveTab }) {
  const fileInputRef = useRef(null);
  const [pickedFile, setPickedFile] = useState(null);   // { name, size, format, text }
  const [status, setStatus] = useState(null);            // { type: 'error'|'success'|'warn', msg }
  const [importing, setImporting] = useState(false);

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    const fmt = detectFormat(file.name);
    const supported = isSupported(file.name);

    if (!supported) {
      setPickedFile({ name: file.name, size: file.size, format: fmt, text: null });
      setStatus({ type: 'warn', msg: `Il formato ${fmt} non è importabile direttamente nel browser. Usa QGIS o uno strumento desktop per convertire il file in GeoJSON prima di importarlo.` });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPickedFile({ name: file.name, size: file.size, format: fmt, text: ev.target.result });
    };
    reader.onerror = () => setStatus({ type: 'error', msg: 'Impossibile leggere il file.' });
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!pickedFile) { setStatus({ type: 'error', msg: 'Seleziona prima un file.' }); return; }
    if (!pickedFile.text) { setStatus({ type: 'error', msg: 'Formato non supportato per l\'importazione browser.' }); return; }

    setImporting(true);
    setStatus(null);

    try {
      const ext = pickedFile.name.split('.').pop().toLowerCase();
      const layerName = pickedFile.name.replace(/\.[^.]+$/, '');
      const layerId = Date.now();

      let features = [];
      if (ext === 'geojson' || ext === 'json') {
        features = parseGeoJSON(pickedFile.text, layerId, layerName);
      } else if (ext === 'kml') {
        features = parseKML(pickedFile.text, layerId, layerName);
      }

      const geomType = inferGeomType(features);

      // Build layer schema from feature properties
      const sampleProps = features[0]?.properties || {};
      const autoFields = Object.keys(sampleProps)
        .filter(k => !['id', 'layerId', 'layerName', 'timestamp', 'source'].includes(k))
        .map(k => ({ name: k, type: 'String', defaultVal: '' }));

      const newLayer = {
        id: layerId,
        name: layerName,
        type: `Vector - ${geomType}`,
        colorHex: '#f97316',
        active: true,
        fields: [
          { name: 'ID', type: 'Integer', defaultVal: 'AUTO_INC' },
          { name: 'Timestamp', type: 'Date', defaultVal: 'NOW' },
          ...autoFields
        ],
        format: ext === 'kml' ? 'kml' : 'geojson',
        formatExt: ext === 'kml' ? '.kml' : '.geojson',
        dirLabel: null,
        symbology: { mode: 'single', attribute: null, rules: [] }
      };

      setLayers(prev => [...prev, newLayer]);
      setCollectedPoints(prev => [...prev, ...features]);
      setSelectedLayerId(layerId);
      setStatus({ type: 'success', msg: `Importate ${features.length} feature nel layer "${layerName}".` });
      setTimeout(() => setActiveTab('layers'), 1200);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setImporting(false);
    }
  };

  const statusColors = { error: 'text-red-400 bg-red-400/10 border-red-400/20', warn: 'text-amber-400 bg-amber-400/10 border-amber-400/20', success: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };

  return (
    <div className="w-full max-w-3xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Import File</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">

        {/* Drop / Pick area */}
        <div className="p-6 sm:p-10 flex flex-col items-center gap-6 border-b border-white/5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-md flex flex-col items-center gap-4 p-8 sm:p-12 rounded-[2rem] border-2 border-dashed border-white/15 hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Click to select a file</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">GeoJSON · JSON · KML</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json,.kml,.gpkg,.shp,.tif,.tiff,.csv,.zip" onChange={handleFilePick} className="hidden" />

          {/* File info card */}
          {pickedFile && (
            <div className="w-full max-w-md p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${isSupported(pickedFile.name) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {pickedFile.format.slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{pickedFile.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{pickedFile.format} · {formatBytes(pickedFile.size)}</p>
              </div>
              <button onClick={() => { setPickedFile(null); setStatus(null); }} className="text-slate-600 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {/* Status message */}
          {status && (
            <div className={`w-full max-w-md p-3 rounded-xl border text-[11px] font-medium ${statusColors[status.type]}`}>
              {status.msg}
            </div>
          )}
        </div>

        {/* Supported formats info */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4">Supported formats (browser-only)</p>
          <div className="space-y-2">
            {[
              { fmt: 'GeoJSON / JSON', desc: 'FeatureCollection o singola Feature', ok: true },
              { fmt: 'KML', desc: 'Keyhole Markup Language — Placemark Point/Line/Polygon', ok: true },
              { fmt: 'GeoPackage (.gpkg)', desc: 'Richiede librerie native — non supportato nel browser', ok: false },
              { fmt: 'Shapefile (.shp)', desc: 'Formato binario — non supportato nel browser', ok: false },
              { fmt: 'GeoTIFF (.tif)', desc: 'Raster — non supportato nel browser', ok: false },
              { fmt: 'CSV', desc: 'In sviluppo — usa GeoJSON come alternativa', ok: false },
            ].map(item => (
              <div key={item.fmt} className="flex items-start gap-3 py-2 border-b border-white/5">
                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">{item.ok ? <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" /> : <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />}</svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{item.fmt}</p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 sm:px-8 py-4 border-t border-white/5 bg-black/20 flex justify-end gap-4">
          <button onClick={() => setActiveTab('explore')} className="px-6 py-3 border border-white/10 rounded-xl font-bold text-slate-500 hover:text-white hover:bg-white/5 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
          <button
            onClick={handleImport}
            disabled={!pickedFile || !pickedFile.text || importing}
            className="px-8 py-3 bg-primary rounded-xl font-bold text-white shadow-xl shadow-primary/20 hover:scale-105 transition-transform uppercase text-[10px] tracking-widest disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
          >
            {importing ? 'Importing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
