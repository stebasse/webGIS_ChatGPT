import { useState } from 'react';
import { chooseWritableDirectory, chooseWritableFile, canChooseOutputFile, chooseDirectoryLabelFallback, fileSystemUnavailableMessage, writeTextToDirectory, writeTextToFileHandle, downloadTextFileFallback } from '../services/fileSystemAccess';

const FIELD_TYPES = ['String', 'Integer', 'Double', 'Date', 'Boolean'];
const DEFAULT_FIELDS = [
  { name: 'ID', type: 'Integer', defaultVal: 'AUTO_INC' }
];

const FORMATS = [
  { id: 'geojson', label: 'GeoJSON', ext: '.geojson', supported: true },
  { id: 'kml', label: 'KML', ext: '.kml', supported: true },
  { id: 'csv', label: 'CSV', ext: '.csv', supported: true, note: 'Points only' },
  { id: 'gpkg', label: 'GeoPackage', ext: '.gpkg', supported: false },
  { id: 'shp', label: 'Shapefile', ext: '.shp', supported: false },
];


export default function NewLayerView({ newLayer, setNewLayer, setActiveTab, layers, setLayers, setSelectedLayerId, projectCrs = 'EPSG:4326' }) {
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [format, setFormat] = useState('geojson');
  const [dirHandle, setDirHandle] = useState(null);   // FileSystemDirectoryHandle
  const [fileHandle, setFileHandle] = useState(null); // FileSystemFileHandle fallback
  const [dirLabel, setDirLabel] = useState('');
  const [errors, setErrors] = useState({});

  const addField = () =>
    setFields(prev => [...prev, { name: `Field_${prev.length + 1}`, type: 'String', defaultVal: '' }]);

  const removeField = (idx) =>
    setFields(prev => prev.filter((_, i) => i !== idx));

  const updateField = (idx, key, value) =>
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));

  const getOutputTargetInfo = () => {
    const selectedFormat = FORMATS.find(f => f.id === format);
    const ext = selectedFormat?.ext || '.geojson';
    const baseName = (newLayer.name?.trim() || 'new_layer').replace(/[^a-z0-9_-]+/gi, '_');
    const mime = format === 'csv' ? 'text/csv' : format === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'application/geo+json';
    const accept = format === 'csv'
      ? { 'text/csv': ['.csv'] }
      : format === 'kml'
        ? { 'application/vnd.google-earth.kml+xml': ['.kml'], 'text/xml': ['.kml'] }
        : { 'application/geo+json': ['.geojson'], 'application/json': ['.geojson'], 'text/plain': ['.geojson'] };
    return { ext, baseName, mime, accept, filename: `${baseName}${ext}` };
  };

  const chooseFolder = async () => {
    try {
      const directoryHandle = await chooseWritableDirectory();
      if (directoryHandle) {
        setDirHandle(directoryHandle);
        setFileHandle(null);
        setDirLabel(directoryHandle.name || 'Cartella selezionata');
        return;
      }

      if (canChooseOutputFile()) {
        const target = getOutputTargetInfo();
        const handle = await chooseWritableFile({
          suggestedName: target.filename,
          description: 'Layer file',
          accept: target.accept,
        });
        if (handle) {
          setFileHandle(handle);
          setDirHandle(null);
          setDirLabel(handle.name || 'File selezionato');
          return;
        }
      }

      const fallbackDirectory = await chooseDirectoryLabelFallback();
      if (fallbackDirectory) {
        setDirHandle(null);
        setFileHandle(null);
        setDirLabel(`${fallbackDirectory.name} (download browser)`);
        return;
      }

      alert(fileSystemUnavailableMessage);
    } catch (e) {
      if (e?.name !== 'AbortError') alert('Impossibile selezionare il percorso: ' + (e?.message || e));
    }
  };

  const validate = () => {
    const errs = {};
    const name = newLayer.name.trim();
    if (!name) errs.name = 'Il nome del layer è obbligatorio.';
    else if (layers.some(l => l.name.toLowerCase() === name.toLowerCase()))
      errs.name = `Esiste già un layer chiamato "${name}". Scegli un nome diverso.`;
    const validFields = fields.filter(f => f.name.trim());
    if (validFields.length === 0) errs.fields = 'Aggiungi almeno un campo con un nome.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createLayer = () => {
    if (!validate()) return;
    const selectedFormat = FORMATS.find(f => f.id === format);
    const id = Date.now();
    const layer = {
      id,
      name: newLayer.name.trim(),
      type: `Vector - ${newLayer.type}`,
      colorHex: '#10b981',
      active: true,
      fields: fields.filter(f => f.name.trim()),
      crs: projectCrs || 'EPSG:4326',
      sourceCrs: projectCrs || 'EPSG:4326',
      displayCrs: projectCrs || 'EPSG:4326',
      format,
      formatExt: selectedFormat?.ext || '.geojson',
      dirHandle: dirHandle || null,
      fileHandle: fileHandle || null,
      dirLabel: dirLabel || null,
      symbology: { mode: 'single', attribute: null, rules: [] }
    };
    const createInitialOutputFile = async () => {
      const hasFallbackDownloadTarget = Boolean(dirLabel && !dirHandle && !fileHandle);
      if (!dirHandle && !fileHandle && !hasFallbackDownloadTarget) return;
      const initialContent = format === 'csv'
        ? fields.filter(f => f.name.trim()).map(f => f.name.trim()).join(',') + '\n'
        : format === 'kml'
          ? '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>'
          : JSON.stringify({ type: 'FeatureCollection', name: layer.name, crs: { type: 'name', properties: { name: layer.crs } }, features: [] }, null, 2);
      const target = getOutputTargetInfo();
      if (dirHandle) await writeTextToDirectory(dirHandle, target.filename, initialContent, target.mime);
      if (fileHandle) await writeTextToFileHandle(fileHandle, initialContent, target.mime);
      if (!dirHandle && !fileHandle && hasFallbackDownloadTarget) downloadTextFileFallback(target.filename, initialContent, target.mime);
    };

    createInitialOutputFile().catch(err => {
      console.error(err);
      alert('Layer creato nel progetto, ma non riesco a scrivere il file nel percorso scelto.');
    });

    setLayers(prev => [...prev, layer]);
    setSelectedLayerId(id);
    setNewLayer({ name: '', type: 'Point' });
    setFields(DEFAULT_FIELDS);
    setFormat('geojson');
    setDirHandle(null);
    setFileHandle(null);
    setDirLabel('');
    setErrors({});
    setActiveTab('layers');
  };

  const geomTypes = [
    { id: 'Point', name: 'Point', icon: null },
    { id: 'Line', name: 'Line', icon: 'M4 12h16' },
    { id: 'Polygon', name: 'Polygon', icon: 'M4 4h16v16H4z' },
    { id: 'Table', name: 'Table (no geometry)', icon: 'M4 6h16M4 12h16M4 18h16' }
  ];

  return (
    <div className="w-full max-w-4xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Create New Layer</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 space-y-8">

          {/* Geometry Type */}
          <section>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Geometry Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {geomTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setNewLayer(prev => ({ ...prev, type: type.id }))}
                  className={`flex flex-col items-center gap-2 p-4 sm:p-6 rounded-[1.5rem] border transition-all group ${newLayer.type === type.id ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${newLayer.type === type.id ? 'text-primary' : 'text-slate-500'}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      {type.id === 'Point'
                        ? <circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity="0.4" />
                        : <path d={type.icon} />}
                    </svg>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest text-center leading-tight ${newLayer.type === type.id ? 'text-white' : 'text-slate-500'}`}>{type.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Layer Name */}
          <section className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Layer Name</label>
            <input
              type="text"
              placeholder="e.g. Vegetation_Survey_2024"
              value={newLayer.name}
              onChange={(e) => { setNewLayer(prev => ({ ...prev, name: e.target.value })); setErrors(p => ({ ...p, name: null })); }}
              className={`w-full bg-white/5 border rounded-2xl px-4 sm:px-6 py-3 text-sm outline-none transition-all text-white ${errors.name ? 'border-red-500' : 'border-white/10 focus:border-primary'}`}
            />
            {errors.name && <p className="text-[10px] text-red-400">{errors.name}</p>}
          </section>

          {/* Output File */}
          <section className="space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Output File</p>

            {/* Format selection */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Format</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${format === f.id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/30 hover:text-white'} ${!f.supported ? 'opacity-40' : ''}`}
                    title={!f.supported ? 'Non supportato in modalità browser-only' : f.note || ''}
                  >
                    {f.label}
                    {f.note && <span className="text-[8px] opacity-60">({f.note})</span>}
                    {!f.supported && <span className="text-[8px] text-red-400 ml-1">⊘</span>}
                  </button>
                ))}
              </div>
              {!FORMATS.find(f => f.id === format)?.supported && (
                <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
                  ⚠ {format.toUpperCase()} non è esportabile direttamente dal browser. L'esportazione sarà disponibile solo tramite strumenti desktop (QGIS, ecc.).
                </p>
              )}
            </div>

            {/* Save folder */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Output Folder</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={chooseFolder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-slate-400 hover:border-primary hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  Choose Folder
                </button>
                {dirLabel && (
                  <span className="text-xs text-emerald-400 font-mono truncate max-w-[200px]">📁 {dirLabel}</span>
                )}
              </div>
            </div>
          </section>

          {/* Attribute Schema */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attribute Schema</label>
              <button
                onClick={addField}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/10 transition-all uppercase tracking-widest"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                Add Field
              </button>
            </div>
            {errors.fields && <p className="text-[10px] text-red-400">{errors.fields}</p>}

            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_36px] gap-2 px-3">
              <span className="text-[9px] font-bold text-slate-600 uppercase">Field Name</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase">Type</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase">Default</span>
              <span />
            </div>

            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_120px_36px] gap-2 p-3 rounded-xl bg-black/20 border border-white/5 items-center">
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(idx, 'name', e.target.value)}
                    className="bg-transparent text-xs text-white outline-none px-2 border-b border-white/10 focus:border-primary/50 transition-colors py-1"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(idx, 'type', e.target.value)}
                    className="hidden sm:block bg-slate-900 text-[10px] text-slate-400 border border-white/10 rounded-lg px-2 py-1 outline-none"
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="text"
                    value={field.defaultVal}
                    onChange={(e) => updateField(idx, 'defaultVal', e.target.value)}
                    placeholder="default..."
                    className="hidden sm:block bg-transparent text-[10px] text-slate-500 outline-none px-2 border-b border-white/10 focus:border-primary/50 py-1"
                  />
                  <button
                    onClick={() => removeField(idx)}
                    disabled={fields.length <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  {/* Mobile row 2 */}
                  <div className="col-span-2 sm:hidden flex gap-2 px-2">
                    <select
                      value={field.type}
                      onChange={(e) => updateField(idx, 'type', e.target.value)}
                      className="flex-1 bg-slate-900 text-[10px] text-slate-400 border border-white/10 rounded-lg px-2 py-1 outline-none"
                    >
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="text"
                      value={field.defaultVal}
                      onChange={(e) => updateField(idx, 'defaultVal', e.target.value)}
                      placeholder="default..."
                      className="flex-1 bg-transparent text-[10px] text-slate-500 outline-none px-2 border-b border-white/10 py-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-4 sm:px-8 py-4 border-t border-white/5 bg-black/20 flex justify-between items-center gap-4">
          <button
            onClick={() => {
              setNewLayer({ name: '', type: 'Point' });
              setFields(DEFAULT_FIELDS);
              setFormat('geojson');
              setDirHandle(null);
              setDirLabel('');
              setErrors({});
              setActiveTab('explore');
            }}
            className="px-4 sm:px-8 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >Cancel</button>
          <button
            onClick={createLayer}
            className="flex-1 sm:flex-none px-8 sm:px-12 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20"
          >
            Create Layer
          </button>
        </div>
      </div>
    </div>
  );
}
