import { useState } from 'react';

const normalizeLayerCrs = (v) => { const clean = String(v || 'EPSG:4326').trim().toUpperCase(); return /^\d+$/.test(clean) ? `EPSG:${clean}` : clean; };

const COLOR_OPTIONS = [
  { label: 'Azzurro', hex: '#0ea5e9', tw: 'bg-sky-500' },
  { label: 'Verde', hex: '#10b981', tw: 'bg-emerald-500' },
  { label: 'Viola', hex: '#8b5cf6', tw: 'bg-violet-500' },
  { label: 'Arancione', hex: '#f97316', tw: 'bg-orange-500' },
  { label: 'Rosa', hex: '#f43f5e', tw: 'bg-rose-500' },
  { label: 'Giallo', hex: '#eab308', tw: 'bg-yellow-500' },
  { label: 'Ciano', hex: '#06b6d4', tw: 'bg-cyan-500' },
  { label: 'Grigio', hex: '#64748b', tw: 'bg-slate-500' },
];

function SimbologiaPanel({ layer, onUpdate, onClose }) {
  const [mode, setMode] = useState(layer.symbology?.mode || 'single');
  const [selectedAttr, setSelectedAttr] = useState(layer.symbology?.attribute || '');
  const [rules, setRules] = useState(layer.symbology?.rules || []);
  const [singleColor, setSingleColor] = useState(layer.colorHex || '#0ea5e9');

  const attributes = layer.fields?.filter(f => f.type !== 'Date') || [];

  const addRule = () => {
    setRules(prev => [...prev, { value: '', color: '#0ea5e9', label: '' }]);
  };

  const updateRule = (idx, key, val) => {
    setRules(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const removeRule = (idx) => {
    setRules(prev => prev.filter((_, i) => i !== idx));
  };

  const save = () => {
    onUpdate({
      colorHex: singleColor,
      color: `bg-[${singleColor}]`,
      symbology: { mode, attribute: selectedAttr, rules }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="glass w-full max-w-lg rounded-[2rem] border border-white/20 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Simbologia</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{layer.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Mode toggle */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modalità resa</p>
            <div className="flex bg-black/30 p-1 rounded-xl gap-1">
              {[
                { id: 'single', label: 'Colore unico' },
                { id: 'categorized', label: 'Per attributo' }
              ].map(m => (
                <button 
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${mode === m.id ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Single color mode */}
          {mode === 'single' && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Colore layer</p>
              <div className="grid grid-cols-4 gap-3">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setSingleColor(c.hex)}
                    className={`h-10 rounded-xl transition-all hover:scale-105 border-2 ${singleColor === c.hex ? 'border-white scale-105 shadow-lg' : 'border-transparent'}`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                <input 
                  type="color" 
                  value={singleColor}
                  onChange={(e) => setSingleColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent"
                />
                <span className="text-xs font-mono text-slate-400">{singleColor.toUpperCase()}</span>
                <span className="text-[10px] text-slate-600 ml-auto">Personalizzato</span>
              </div>
            </div>
          )}

          {/* Categorized by attribute */}
          {mode === 'categorized' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Attributo</p>
                {attributes.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic p-3 rounded-xl bg-black/20 border border-white/5">
                    Nessun attributo definito. Aggiungi prima i campi nello schema del layer.
                  </p>
                ) : (
                  <select
                    value={selectedAttr}
                    onChange={(e) => setSelectedAttr(e.target.value)}
                    className="w-full bg-slate-900 text-sm text-white border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
                  >
                    <option value="">— Seleziona attributo —</option>
                    {attributes.map(f => <option key={f.name} value={f.name}>{f.name} ({f.type})</option>)}
                  </select>
                )}
              </div>

              {selectedAttr && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Regole colore</p>
                    <button
                      onClick={addRule}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all uppercase tracking-wider"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
                      Aggiungi regola
                    </button>
                  </div>

                  {rules.length === 0 && (
                    <p className="text-[10px] text-slate-600 italic p-3 rounded-xl bg-black/20 border border-white/5">
                      Tocca "Aggiungi regola" per definire un colore per uno specifico valore attributo.
                    </p>
                  )}

                  <div className="space-y-2">
                    {rules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                        <input 
                          type="color"
                          value={rule.color}
                          onChange={e => updateRule(idx, 'color', e.target.value)}
                          className="w-8 h-8 rounded-lg border-0 cursor-pointer bg-transparent flex-shrink-0"
                        />
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={rule.value}
                            onChange={e => updateRule(idx, 'value', e.target.value)}
                            placeholder="Attributo value..."
                            className="bg-transparent text-xs text-white outline-none border-b border-white/10 focus:border-primary/50 py-1 transition-colors"
                          />
                          <input
                            type="text"
                            value={rule.label}
                            onChange={e => updateRule(idx, 'label', e.target.value)}
                            placeholder="Etichetta (opzionale)"
                            className="bg-transparent text-xs text-slate-500 outline-none border-b border-white/10 focus:border-primary/50 py-1 transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => removeRule(idx)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {rules.length > 0 && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-[9px] text-primary/60 uppercase tracking-wider font-bold">
                        Tutti gli altri valori → colore base del layer
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Annulla</button>
          <button onClick={save} className="px-8 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs">
            Applica
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LayersView({ 
  layers, layerFilter, setLayerFilter, selectedLayerId, setSelectedLayerId, toggleLayer, deleteLayer, setActiveTab, setLayers
}) {
  const [symbologyLayerId, setSimbologiaLayerId] = useState(null);
  const symbologyLayer = symbologyLayerId ? layers.find(l => l.id === symbologyLayerId) : null;

  const updateLayerSimbologia = (id, updates) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const updateLayerCrs = (id, value) => {
    const crs = normalizeLayerCrs(value);
    setLayers(prev => prev.map(l => l.id === id ? { ...l, crs, sourceCrs: crs } : l));
  };

  return (
    <div className="w-full max-w-4xl h-full mx-auto flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      {symbologyLayer && (
        <SimbologiaPanel 
          layer={symbologyLayer}
          onUpdate={(updates) => updateLayerSimbologia(symbologyLayer.id, updates)}
          onClose={() => setSimbologiaLayerId(null)}
        />
      )}

      <div className="mb-4 sm:mb-8 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Indice layer</h2>
      </div>

      <div className="flex-1 w-full glass bg-slate-950 light-theme:bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-white/25 overflow-hidden flex flex-col min-h-0 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        {/* Header */}
        <div className="px-4 sm:px-8 py-3 sm:py-4 border-b border-white/10 bg-slate-950/90 light-theme:bg-white flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-start sm:items-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gestisci layer</p>
          <div className="relative w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Filtra layer..." 
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] w-full sm:w-48 focus:border-primary outline-none transition-all" 
            />
            <svg className="w-3 h-3 absolute right-3 top-2.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
          {layers.filter(l => l.name.toLowerCase().includes(layerFilter.toLowerCase())).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600 py-16">
              <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <p className="text-sm font-bold uppercase tracking-widest">{layerFilter ? 'Nessun risultato' : 'Nessun layer presente'}</p>
              {!layerFilter && <p className="text-[10px] text-center max-w-xs">Crea un nuovo layer o importa un file GeoJSON / KML usando i pulsanti in basso.</p>}
            </div>
          ) : (
          <div className="space-y-3">
            {layers.filter(l => l.name.toLowerCase().includes(layerFilter.toLowerCase())).map(layer => (
              <div
                key={layer.id}
                onClick={() => setSelectedLayerId(layer.id)}
                className={`p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border flex flex-col gap-3 group transition-all cursor-pointer ${selectedLayerId === layer.id ? 'bg-primary/10 border-primary' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Color swatch — use inline style to avoid Tailwind purge issues */}
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <div
                        className="w-4 h-4 rounded-sm shadow-lg"
                        style={{ backgroundColor: layer.colorHex || '#0ea5e9' }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{layer.name}</h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{layer.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {/* Simbologia button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSimbologiaLayerId(layer.id); }}
                      className="p-2 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-all"
                      title="Modifica simbologia"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                    </button>
                    {/* Visibility toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLayer(layer.id); }}
                      className={`p-2 transition-colors ${layer.active ? 'text-primary' : 'text-slate-700'}`}
                      title={layer.active ? 'Nascondi layer' : 'Mostra layer'}
                    >
                      {layer.active
                        ? <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        : <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.225 0 2.39.27 3.425.75m4.575 4.25c.345.62.613 1.284.8 2a10.05 10.05 0 01-9.542 7m6.5-6.5l-6.5 6.5M3 3l18 18" /></svg>
                      }
                    </button>
                    {/* Delete layer */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                      className="p-2 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Elimina layer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                <div className="px-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">CRS layer</span>
                  <input
                    defaultValue={layer.crs || layer.sourceCrs || 'EPSG:4326'}
                    onBlur={(e) => updateLayerCrs(layer.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-slate-300 outline-none focus:border-primary font-mono"
                    title="CRS layer. Premi Invio o esci dal campo per salvare."
                  />
                </div>

                {/* Categorized symbology badge */}
                {layer.symbology?.mode === 'categorized' && layer.symbology?.attribute && (
                  <div className="flex items-center gap-2 px-2">
                    <svg className="w-3 h-3 text-primary/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                    <span className="text-[9px] text-primary/60 font-bold uppercase tracking-wider">Per: {layer.symbology.attribute}</span>
                    <div className="flex gap-1">
                      {layer.symbology.rules.slice(0, 5).map((r, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: r.color }} title={r.value} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-10 py-4 sm:py-8 border-t border-white/10 bg-slate-950/90 light-theme:bg-white flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setActiveTab('new-layer')}
            className="flex-1 px-6 sm:px-8 py-3 sm:py-4 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 flex items-center justify-center gap-2 text-xs"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Crea nuovo layer
          </button>
          <button 
            onClick={() => setActiveTab('upload')}
            className="flex-1 px-6 sm:px-8 py-3 sm:py-4 bg-white/5 text-white border border-white/10 font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importa dati
          </button>
          <button
            onClick={() => selectedLayerId && deleteLayer(selectedLayerId)}
            disabled={!selectedLayerId}
            className={`flex-1 px-6 sm:px-8 py-3 sm:py-4 border font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 text-xs ${selectedLayerId ? 'bg-red-500/10 text-red-300 border-red-400/30 hover:bg-red-500/20' : 'bg-white/5 text-slate-700 border-white/10 cursor-not-allowed'}`}
            title="Rimuovi layer selezionato dal progetto"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Rimuovi selezionato
          </button>
        </div>
      </div>
    </div>
  );
}
