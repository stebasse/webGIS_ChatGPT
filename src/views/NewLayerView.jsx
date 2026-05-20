import { useState } from 'react';
import { t as translate, fieldTypeLabel } from '../i18n';
import { canChooseDirectory, canChooseOutputFile, chooseWritableDirectory, chooseWritableFile, fileSystemUnavailableMessage, writeTextToDirectory, writeTextToFileHandle, downloadTextFileFallback } from '../services/fileSystemAccess';

const FIELD_TYPES = ['String', 'Integer', 'Double', 'Date', 'Boolean'];
const DEFAULT_FIELDS = [
  { name: 'ID', type: 'Integer', defaultVal: 'AUTO_INC' }
];

const FORMATS = [
  { id: 'geojson', label: 'GeoJSON', ext: '.geojson', supported: true },
  { id: 'kml', label: 'KML', ext: '.kml', supported: true },
  { id: 'csv', label: 'CSV', ext: '.csv', supported: true, noteKey: 'pointOnly' },
  { id: 'gpkg', label: 'GeoPackage', ext: '.gpkg', supported: false },
  { id: 'shp', label: 'Shapefile', ext: '.shp', supported: false },
];


export default function NewLayerView({ newLayer, setNewLayer, setActiveTab, layers, setLayers, setSelectedLayerId, projectCrs = 'EPSG:4326', language = 'it' }) {
  const tt = (key) => translate(language, key);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [format, setFormat] = useState('geojson');
  const [dirHandle, setDirHandle] = useState(null);   // FileSystemDirectoryHandle
  const [fileHandle, setFileHandle] = useState(null); // FileSystemFileHandle fallback
  const [dirLabel, setDirLabel] = useState('');
  const [showOutputTargetDialog, setShowOutputTargetDialog] = useState(false);
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

  const chooseFolder = () => {
    setShowOutputTargetDialog(true);
  };

  const chooseDirectoryTarget = async () => {
    try {
      const handle = await chooseWritableDirectory();
      if (!handle) return;
      setDirHandle(handle);
      setFileHandle(null);
      setDirLabel(handle.name || tt('selectedFolder'));
      setShowOutputTargetDialog(false);
    } catch (e) {
      if (e?.name !== 'AbortError') alert(tt('selectFolderFailed') + ' ' + (e?.message || e));
    }
  };

  const chooseFileTarget = async () => {
    try {
      const target = getOutputTargetInfo();
      const handle = await chooseWritableFile({
        suggestedName: target.filename,
        description: 'File layer',
        accept: target.accept,
      });
      if (!handle) return;
      setFileHandle(handle);
      setDirHandle(null);
      setDirLabel(handle.name || target.filename);
      setShowOutputTargetDialog(false);
    } catch (e) {
      if (e?.name !== 'AbortError') alert(tt('selectFileFailed') + ' ' + (e?.message || e));
    }
  };

  const useDownloadTarget = () => {
    setDirHandle(null);
    setFileHandle(null);
    setDirLabel(tt('browserDownload'));
    setShowOutputTargetDialog(false);
  };

  const getVisibleOutputPath = () => {
    const target = getOutputTargetInfo();
    if (dirHandle) {
      return `${dirLabel || dirHandle.name || tt('selectedFolder')}/${target.filename}`;
    }
    if (fileHandle) {
      return fileHandle.name || target.filename;
    }
    return `${tt('browserDownload')}/${target.filename}`;
  };

  const validate = () => {
    const errs = {};
    const name = newLayer.name.trim();
    if (!name) errs.name = tt('nameRequired');
    else if (layers.some(l => l.name.toLowerCase() === name.toLowerCase()))
      errs.name = language === 'en' ? `${tt('duplicateLayerNamePrefix')} "${name}" ${tt('duplicateLayerNameSuffix')}` : `${tt('duplicateLayerNamePrefix')} "${name}". ${tt('duplicateLayerNameSuffix')}`;
    const validFields = fields.filter(f => f.name.trim());
    if (validFields.length === 0) errs.fields = tt('addAtLeastOneField');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const createLayer = () => {
    if (!validate()) return;
    const selectedFormat = FORMATS.find(f => f.id === format);
    const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const geometryType = newLayer.type || 'Point';
    const layer = {
      id,
      name: newLayer.name.trim(),
      type: `Vector - ${geometryType}`,
      geometryType,
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
      outputPathLabel: getVisibleOutputPath(),
      symbology: { mode: 'single', attribute: null, rules: [] }
    };
    const createInitialOutputFile = async () => {
      const hasFallbackDownloadTarget = !dirHandle && !fileHandle;
      const initialContent = format === 'csv'
        ? fields.filter(f => f.name.trim()).map(f => f.name.trim()).join(',') + '\n'
        : format === 'kml'
          ? '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>'
          : JSON.stringify({ type: 'FeatureCollection', name: layer.name, crs: { type: 'name', properties: { name: layer.crs } }, features: [] }, null, 2);
      const target = getOutputTargetInfo();
      if (dirHandle) await writeTextToDirectory(dirHandle, target.filename, initialContent, target.mime);
      if (fileHandle) await writeTextToFileHandle(fileHandle, initialContent, target.mime);
      if (!dirHandle && !fileHandle && hasFallbackDownloadTarget) downloadTextFileFallback(target.filename, initialContent, target.mime);
      return getVisibleOutputPath();
    };

    createInitialOutputFile()
      .then((savedPath) => {
        if (savedPath) alert(`${tt('layerSavedAt')} ${layer.name}: ${savedPath}`);
      })
      .catch(err => {
        console.error(err);
        alert(tt('layerCreatedFileWriteFailed'));
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
    setActiveTab('explore');
  };

  const geomTipos = [
    { id: 'Point', nameKey: 'point', icon: null },
    { id: 'Line', nameKey: 'line', icon: 'M4 12h16' },
    { id: 'Polygon', nameKey: 'polygon', icon: 'M4 4h16v16H4z' },
    { id: 'Table', nameKey: 'table', icon: 'M4 6h16M4 12h16M4 18h16' }
  ];

  return (
    <div className="w-full max-w-4xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">{tt('createNewLayer')}</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 space-y-8">

          {/* Tipo geometria */}
          <section>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">{tt('geometryType')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {geomTipos.map(type => (
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
                  <span className={`text-[9px] font-bold uppercase tracking-widest text-center leading-tight ${newLayer.type === type.id ? 'text-white' : 'text-slate-500'}`}>{type.id === 'Point' ? tt('point') : type.id === 'Line' ? tt('line') : type.id === 'Polygon' ? tt('polygon') : tt('table')}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Nome layer */}
          <section className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tt('layerName')}</label>
            <input
              type="text"
              placeholder="es. Rilievo_Vegetazione_2024"
              value={newLayer.name}
              onChange={(e) => { setNewLayer(prev => ({ ...prev, name: e.target.value })); setErrors(p => ({ ...p, name: null })); }}
              className={`w-full bg-white/5 border rounded-2xl px-4 sm:px-6 py-3 text-sm outline-none transition-all text-white ${errors.name ? 'border-red-500' : 'border-white/10 focus:border-primary'}`}
            />
            {errors.name && <p className="text-[10px] text-red-400">{errors.name}</p>}
          </section>

          {/* File di output */}
          <section className="space-y-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tt('outputFile')}</p>

            {/* Format selection */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{tt('format')}</label>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${format === f.id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/30 hover:text-white'} ${!f.supported ? 'opacity-40' : ''}`}
                    title={!f.supported ? tt('browserOnlyUnsupported') : (f.noteKey ? tt(f.noteKey) : '')}
                  >
                    {f.label}
                    {f.noteKey && <span className="text-[8px] opacity-60">({tt(f.noteKey)})</span>}
                    {!f.supported && <span className="text-[8px] text-red-400 ml-1">⊘</span>}
                  </button>
                ))}
              </div>
              {!FORMATS.find(f => f.id === format)?.supported && (
                <p className="text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
                  ⚠ {format.toUpperCase()} {tt('formatNotExportableBrowser')}
                </p>
              )}
            </div>

            {/* Save folder */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{tt('outputFolder')}</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={chooseFolder}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-slate-400 hover:border-primary hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLineacap="round" strokeLineajoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  {tt('choose')} {tt('output')}
                </button>
                <span className="text-xs text-emerald-400 font-mono break-all flex-1 min-w-0">📁 {getVisibleOutputPath()}</span>
              </div>
            </div>
          </section>

          {/* Schema attributi */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{tt('attributeSchema')}</label>
              <button
                onClick={addField}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold text-primary border border-primary/30 rounded-xl hover:bg-primary/10 transition-all uppercase tracking-widest"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLineacap="round" strokeLineajoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                {tt('addField')}
              </button>
            </div>
            {errors.fields && <p className="text-[10px] text-red-400">{errors.fields}</p>}

            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_36px] gap-2 px-3">
              <span className="text-[9px] font-bold text-slate-600 uppercase">{tt('fieldName')}</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase">{tt('type')}</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase">{tt('defaultValue')}</span>
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
                    {FIELD_TYPES.map(type => <option key={type} value={type}>{fieldTypeLabel(language, type)}</option>)}
                  </select>
                  <input
                    type="text"
                    value={field.defaultVal}
                    onChange={(e) => updateField(idx, 'defaultVal', e.target.value)}
                    placeholder={tt('defaultValue')}
                    className="hidden sm:block bg-transparent text-[10px] text-slate-500 outline-none px-2 border-b border-white/10 focus:border-primary/50 py-1"
                  />
                  <button
                    onClick={() => removeField(idx)}
                    disabled={fields.length <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLineacap="round" strokeLineajoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  {/* Mobile row 2 */}
                  <div className="col-span-2 sm:hidden flex gap-2 px-2">
                    <select
                      value={field.type}
                      onChange={(e) => updateField(idx, 'type', e.target.value)}
                      className="flex-1 bg-slate-900 text-[10px] text-slate-400 border border-white/10 rounded-lg px-2 py-1 outline-none"
                    >
                      {FIELD_TYPES.map(type => <option key={type} value={type}>{fieldTypeLabel(language, type)}</option>)}
                    </select>
                    <input
                      type="text"
                      value={field.defaultVal}
                      onChange={(e) => updateField(idx, 'defaultVal', e.target.value)}
                      placeholder={tt('defaultValue')}
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
              setFileHandle(null);
              setDirLabel('');
              setErrors({});
              setActiveTab('explore');
            }}
            className="px-4 sm:px-8 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >{tt('cancel')}</button>
          <button
            onClick={createLayer}
            className="flex-1 sm:flex-none px-8 sm:px-12 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20"
          >
            {tt('createLayer')}
          </button>
        </div>
      </div>

      {showOutputTargetDialog && (
        <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-xs rounded-[2rem] border border-white/15 shadow-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white">{tt('outputFolder')}</h3>
                <p className="text-[9px] text-slate-500 mt-1 leading-snug">{tt('chooseNewLayerDestination')}</p>
              </div>
              <button type="button" onClick={() => setShowOutputTargetDialog(false)} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400">×</button>
            </div>

            {canChooseDirectory() && (
              <button type="button" onClick={chooseDirectoryTarget} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left text-[10px] font-bold uppercase tracking-widest text-white hover:border-primary">
                {tt('chooseFolder')}
              </button>
            )}

            {canChooseOutputFile() && (
              <button type="button" onClick={chooseFileTarget} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left text-[10px] font-bold uppercase tracking-widest text-white hover:border-primary">
                {tt('chooseOutputFile')}
              </button>
            )}

            <button type="button" onClick={useDownloadTarget} className="w-full px-4 py-3 rounded-xl bg-primary text-white text-left text-[10px] font-bold uppercase tracking-widest">
              {tt('useBrowserDownload')}
            </button>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{tt('fullFilePath')}</div>
              <div className="text-[10px] text-emerald-300 font-mono break-all mt-1">{getVisibleOutputPath()}</div>
            </div>

            <p className="text-[8px] text-slate-500 leading-snug">{tt('folderChoiceHelp')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
