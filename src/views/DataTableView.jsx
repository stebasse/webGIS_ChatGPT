import { useState } from 'react';

export default function DataTableView({ collectedPoints, setCollectedPoints, layers, exportData, projectCrs = 'EPSG:4326' }) {
  const [filterLayerId, setFilterLayerId] = useState('all');
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportDirectoryHandle, setExportDirectoryHandle] = useState(null);
  const [exportDirectoryLabel, setExportDirectoryLabel] = useState('Download browser');
  const [exportOptions, setExportOptions] = useState({
    filename: `webgis_export_${new Date().toISOString().split('T')[0]}`,
    extension: 'geojson',
    crsMode: 'project',
    customCrs: projectCrs,
  });

  const displayedFeatures = filterLayerId === 'all'
    ? collectedPoints
    : collectedPoints.filter(f => String(f.properties.layerId) === String(filterLayerId));

  const handleDelete = (id) => {
    if (!window.confirm('Eliminare questa feature?')) return;
    setCollectedPoints(prev => prev.filter(p => p.properties.id !== id));
    if (selectedFeatureId === id) setSelectedFeatureId(null);
  };

  const openExportDialog = () => {
    const label = filterLayerId === 'all'
      ? 'all_layers'
      : (layers.find(l => String(l.id) === String(filterLayerId))?.name || 'layer');
    setExportOptions(prev => ({
      ...prev,
      filename: `${label}_${new Date().toISOString().split('T')[0]}`,
      customCrs: projectCrs,
    }));
    setShowExportDialog(true);
  };

  const chooseExportFolder = async () => {
    if (!window.showDirectoryPicker) {
      alert('Questo browser non permette la scelta della cartella. Verrà usato il download standard.');
      return;
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setExportDirectoryHandle(handle);
      setExportDirectoryLabel(handle.name || 'Cartella selezionata');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        alert('Non riesco ad accedere alla cartella selezionata.');
      }
    }
  };

  const runExport = async () => {
    const layerId = filterLayerId === 'all' ? null : filterLayerId;
    const crs = exportOptions.crsMode === 'custom' ? exportOptions.customCrs : undefined;
    await exportData?.({
      layerId,
      filename: exportOptions.filename,
      extension: exportOptions.extension,
      crsMode: exportOptions.crsMode,
      crs,
      directoryHandle: exportDirectoryHandle,
    });
    setShowExportDialog(false);
  };

  const standardKeys = new Set(['id', 'layerId', 'layerName', 'timestamp', 'accuracy', 'source', 'sourceCrs', 'exportCrs']);
  const extraKeys = [...new Set(displayedFeatures.flatMap(f => Object.keys(f.properties || {})).filter(k => !standardKeys.has(k)))].slice(0, 4);
  const selectedFeature = selectedFeatureId ? collectedPoints.find(f => f.properties.id === selectedFeatureId) : null;

  return (
    <div className="w-full max-w-5xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 mt-2 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Attribute Table</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-8 py-4 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <select
              value={filterLayerId}
              onChange={e => setFilterLayerId(e.target.value)}
              className="bg-slate-900 text-[10px] font-bold text-white border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-primary transition-colors"
            >
              <option value="all">All layers ({collectedPoints.length})</option>
              {layers.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({collectedPoints.filter(f => f.properties.layerId === l.id).length})</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500">{displayedFeatures.length} feature</span>
          </div>

          <button
            onClick={openExportDialog}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>

        <div className="hidden sm:grid px-8 py-3 border-b border-white/5 bg-black/10 text-[9px] font-bold text-slate-600 uppercase tracking-widest"
          style={{ gridTemplateColumns: `auto 1fr auto auto ${extraKeys.map(() => '1fr').join(' ')} auto` }}>
          <div className="w-12">ID</div><div>Layer</div><div className="w-20">Geom</div><div className="w-28">Timestamp</div>
          {extraKeys.map(k => <div key={k} className="truncate">{k}</div>)}
          <div className="w-16 text-right">Actions</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {displayedFeatures.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600 p-8">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-sm font-bold uppercase tracking-widest">No features collected</p>
              <p className="text-[10px] text-center max-w-xs">Usa "Add Geom" dalla mappa per raccogliere punti, linee o poligoni, oppure importa un file dalla sezione Upload.</p>
            </div>
          ) : displayedFeatures.map(feat => {
            const layer = layers.find(l => l.id === feat.properties.layerId);
            const isSelected = selectedFeatureId === feat.properties.id;
            return (
              <div key={feat.properties.id} onClick={() => setSelectedFeatureId(isSelected ? null : feat.properties.id)}
                className={`grid items-center px-4 sm:px-8 py-3 border-b border-white/5 transition-all cursor-pointer text-xs ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-white/5'}`}
                style={{ gridTemplateColumns: `auto 1fr auto auto ${extraKeys.map(() => '1fr').join(' ')} auto` }}>
                <div className="w-12 font-mono text-slate-500 text-[9px]">…{String(feat.properties.id).slice(-4)}</div>
                <div className="flex items-center gap-2 min-w-0"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: layer?.colorHex || '#64748b' }} /><span className="text-white font-semibold truncate">{layer?.name || 'Unknown'}</span></div>
                <div className="w-20 text-primary font-medium">{feat.geometry?.type || 'Table'}</div>
                <div className="w-28 text-slate-500 text-[9px] font-mono">{feat.properties.timestamp ? new Date(feat.properties.timestamp).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
                {extraKeys.map(k => <div key={k} className="truncate text-slate-400 text-[10px] px-1">{String(feat.properties[k] ?? '')}</div>)}
                <div className="w-16 flex justify-end" onClick={e => e.stopPropagation()}><button onClick={() => handleDelete(feat.properties.id)} className="px-2 py-1 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-bold hover:bg-red-500 hover:text-white transition-colors">Del</button></div>
              </div>
            );
          })}
        </div>

        {selectedFeature && (
          <div className="border-t border-white/10 bg-black/30 px-4 sm:px-8 py-4 max-h-48 overflow-y-auto custom-scrollbar">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Feature Properties</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(selectedFeature.properties).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5"><span className="text-[8px] font-bold text-slate-600 uppercase">{k}</span><span className="text-[10px] text-white font-mono break-all">{String(v)}</span></div>
              ))}
              {selectedFeature.geometry?.coordinates && <div className="flex flex-col gap-0.5 col-span-2"><span className="text-[8px] font-bold text-slate-600 uppercase">Coordinates</span><span className="text-[10px] text-primary font-mono">{JSON.stringify(selectedFeature.geometry.coordinates).slice(0, 80)}…</span></div>}
            </div>
          </div>
        )}
      </div>

      {showExportDialog && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-sm rounded-[2rem] border border-white/15 shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Export</h3><p className="text-[10px] text-slate-500 mt-1">Scegli nome, estensione, percorso e CRS.</p></div><button onClick={() => setShowExportDialog(false)} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400">×</button></div>
            <label className="block space-y-1"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Nome file</span><input value={exportOptions.filename} onChange={e => setExportOptions(o => ({ ...o, filename: e.target.value }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary" /></label>
            <label className="block space-y-1"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Estensione</span><select value={exportOptions.extension} onChange={e => setExportOptions(o => ({ ...o, extension: e.target.value }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"><option value="geojson">GeoJSON</option><option value="json">JSON</option><option value="csv">CSV</option></select></label>
            <label className="block space-y-1"><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">CRS</span><select value={exportOptions.crsMode} onChange={e => setExportOptions(o => ({ ...o, crsMode: e.target.value }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"><option value="project">Project CRS ({projectCrs})</option><option value="layer">Layer CRS</option><option value="wgs84">WGS84 (EPSG:4326)</option><option value="custom">Custom EPSG</option></select></label>
            {exportOptions.crsMode === 'custom' && <input value={exportOptions.customCrs} onChange={e => setExportOptions(o => ({ ...o, customCrs: e.target.value }))} placeholder="EPSG:32632" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary" />}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Percorso</div>
                  <div className="text-[10px] text-white/70 truncate">{exportDirectoryLabel}</div>
                </div>
                <button onClick={chooseExportFolder} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white hover:border-primary hover:text-primary">Scegli</button>
              </div>
              <p className="text-[8px] text-slate-500 leading-snug">La scelta cartella funziona sui browser compatibili. Su Safari/Firefox/alcuni Android si userà il download standard.</p>
            </div>
            <button onClick={runExport} className="w-full px-5 py-3 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20">Esporta</button>
          </div>
        </div>
      )}
    </div>
  );
}
