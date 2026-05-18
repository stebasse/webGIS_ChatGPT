import { useEffect, useMemo, useState } from 'react';
import { FALLBACK_CRS, fetchCRSDefinition, getCrsInfo, registerCRS, searchCRSCatalog } from '../services/crsService';

const DEFAULT_SETTINGS = {
  theme: 'dark', units: 'metric', crsOverride: false, projectCrs: 'EPSG:4326',
  customCrsText: '', gpu: true, logLevel: 'low', compassMode: false
};

function Toggle({ value, onChange }) {
  return (
    <div onClick={onChange} className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${value ? 'bg-primary' : 'bg-white/10'}`}>
      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${value ? 'left-6' : 'left-1'}`} />
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
      </div>
      <h3 className="text-xs font-bold text-white uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function SegmentControl({ value, onChange, options }) {
  return (
    <div className="flex bg-slate-900 p-1 rounded-xl">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${value === o.value ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export default function ImpostazioniView({ draftImpostazioni, setDraftSettings, saveSettings, showTutorialAgain }) {
  const s = { ...DEFAULT_SETTINGS, ...draftImpostazioni };
  const set = (key, val) => setDraftSettings(prev => ({ ...prev, [key]: val }));
  const [crsResults, setCrsResults] = useState(FALLBACK_CRS);
  const [crsLoading, setCrsLoading] = useState(false);
  const [crsMessage, setCrsMessage] = useState('');
  const crsQuery = String(s.crsSearch || '');
  const activeCrs = useMemo(() => getCrsInfo(s.projectCrs || 'EPSG:4326'), [s.projectCrs]);

  useEffect(() => {
    let cancelled = false;
    const q = crsQuery.trim();
    if (!q) {
      setCrsResults(FALLBACK_CRS);
      setCrsLoading(false);
      return;
    }
    setCrsLoading(true);
    const t = setTimeout(async () => {
      const results = await searchCRSCatalog(q);
      if (!cancelled) {
        setCrsResults(results.length ? results : FALLBACK_CRS);
        setCrsLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [crsQuery]);

  const applyCustomEpsg = async () => {
    const raw = String(s.crsSearch || '').trim();
    if (!raw) return;
    const code = /^\d+$/.test(raw) ? `EPSG:${raw}` : raw.toUpperCase();
    setCrsMessage('Caricamento definizione CRS...');
    const def = await fetchCRSDefinition(code);
    setDraftSettings(prev => ({ ...prev, projectCrs: code, crsOverride: true }));
    setCrsMessage(def ? `${code} registrato con proj4.` : `${code} salvato. Nessuna definizione PROJ trovata nel browser.`);
  };

  const addCustomCrs = () => {
    const raw = String(s.customCrsText || '').trim();
    if (!raw) return;
    const code = String(s.customCrsCode || '').trim().toUpperCase() || `CUSTOM:${Date.now()}`;
    const ok = registerCRS(code, raw, 'CRS personalizzato');
    if (!ok) {
      setCrsMessage('CRS personalizzato not valid. Use a PROJ string such as +proj=utm +zone=32 +datum=WGS84 +units=m +no_defs.');
      return;
    }
    setDraftSettings(prev => ({ ...prev, projectCrs: code, crsOverride: true }));
    setCrsMessage(`${code} registrato come CRS personalizzato.`);
  };

  return (
    <div className="w-full max-w-4xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Impostazioni</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-10">

          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />} title="Riferimento coordinate" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">CRS progetto</p>
                <p className="text-base font-bold text-primary font-mono">{s.projectCrs || 'EPSG:4326'}</p>
                <p className="text-[9px] text-slate-500">{activeCrs.name}</p>
                <p className={`text-[9px] ${activeCrs.transformable ? 'text-emerald-400' : 'text-amber-400'}`}>{activeCrs.transformable ? 'proj4 attivo — trasformazioni CRS abilitate' : 'Definizione PROJ non disponibile — salvato solo come metadato'}</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors" onClick={() => set('crsOverride', !s.crsOverride)}>
                <div>
                  <p className="text-[10px] font-bold text-white uppercase">CRS progetto Override</p>
                  <p className="text-[10px] text-slate-500 mt-1">Use CRS progetto for coordinates, measurements and export when transformable.</p>
                </div>
                <Toggle value={s.crsOverride} onChange={() => set('crsOverride', !s.crsOverride)} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <input type="text" value={crsQuery} onChange={(e) => set('crsSearch', e.target.value)} placeholder="Cerca codice EPSG, nome CRS o paese, es. 32632, UTM, Italia" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <button onClick={applyCustomEpsg} className="px-5 py-3 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Applica EPSG</button>
            </div>

            <div className="mt-3 space-y-2">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Catalogo EPSG dinamico {crsLoading ? '· ricerca...' : ''}</label>
              <select value={s.projectCrs || 'EPSG:4326'} onChange={async (e) => { const code = e.target.value; setDraftSettings(prev => ({ ...prev, projectCrs: code, crsOverride: true, crsSearch: '' })); await fetchCRSDefinition(code); }} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary">
                {crsResults.map(crs => <option key={crs.code} value={crs.code} className="bg-[#0f172a] text-white">{crs.code} — {crs.name}</option>)}
                {!crsResults.some(crs => crs.code === s.projectCrs) && <option value={s.projectCrs} className="bg-[#0f172a] text-white">{s.projectCrs} — CRS selezionato</option>}
              </select>
              <p className="text-[9px] text-slate-600">Cerca online quando disponibile; risultati e definizioni vengono salvati localmente per l'uso offline.</p>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Definizione PROJ attiva</p>
              <code className="text-[10px] text-slate-400 font-mono break-all">{activeCrs.definition || 'Definizione non disponibile. Il CRS viene comunque salvato, ma le trasformazioni sono disabilitate finché non viene registrata una definizione PROJ.'}</code>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">Aggiungi CRS personalizzato</p>
              <input value={s.customCrsCode || ''} onChange={(e) => set('customCrsCode', e.target.value)} placeholder="Codice, es. CUSTOM:UTM32 o EPSG:999999" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <textarea value={s.customCrsText || ''} onChange={(e) => set('customCrsText', e.target.value)} rows={3} placeholder="Incolla stringa PROJ, es. +proj=utm +zone=32 +datum=WGS84 +units=m +no_defs" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-primary" />
              <button onClick={addCustomCrs} className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:border-primary hover:text-primary transition-all">Registra CRS personalizzato</button>
              {crsMessage && <p className="text-[10px] text-primary">{crsMessage}</p>}
            </div>
          </section>

          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />} title="Visualizzazione" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2"><p className="text-[10px] font-bold text-slate-500 uppercase">Tema interfaccia</p><SegmentControl value={s.theme} onChange={v => set('theme', v)} options={[{ value: 'light', label: 'Chiaro' }, { value: 'dark', label: 'Scuro' }]} /><p className="text-[9px] text-slate-600">L'anteprima del tema è immediata; Salva modifiche la rende permanente.</p></div>
              <div className="space-y-2"><p className="text-[10px] font-bold text-slate-500 uppercase">Unità</p><SegmentControl value={s.units} onChange={v => set('units', v)} options={[{ value: 'metric', label: 'Metrico (m, km)' }, { value: 'imperial', label: 'Imperiale (ft, mi)' }]} /><p className="text-[9px] text-slate-600">Influisce su scala, misure e visualizzazione coordinate.</p></div>
            </div>
          </section>

          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />} title="Sensori e sistema" />
            <div className="space-y-1">
              <div className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer" onClick={() => set('compassMode', !s.compassMode)}><div><p className="text-xs font-bold text-white uppercase">Modalità bussola</p><p className="text-[10px] text-slate-500">Ruota la mappa in base all'orientamento del dispositivo.</p></div><Toggle value={s.compassMode} onChange={() => set('compassMode', !s.compassMode)} /></div>
              <div className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer" onClick={() => set('gpu', !s.gpu)}><div><p className="text-xs font-bold text-white uppercase">Accelerazione hardware</p><p className="text-[10px] text-slate-500">Suggerimento compositing GPU CSS per le tile mappa.</p></div><Toggle value={s.gpu} onChange={() => set('gpu', !s.gpu)} /></div>
              <div className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer" onClick={() => set('logLevel', s.logLevel === 'high' ? 'low' : 'high')}><div><p className="text-xs font-bold text-white uppercase">Log debug</p><p className="text-[10px] text-slate-500">Scrive log dettagliati nella console del browser.</p></div><div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border transition-colors ${s.logLevel === 'high' ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-slate-500'}`}>{s.logLevel === 'high' ? 'Dettagliato' : 'Spento'}</div></div>
            </div>
          </section>

          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.194-.925 2.226-2.263 2.708-.688.248-1.237.826-1.237 1.558V15m-.5 4h.01" />} title="Aiuto" />
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="text-xs font-bold text-white uppercase">Guida rapida</p><p className="text-[10px] text-slate-500 mt-1">Mostra di nuovo il tutorial iniziale.</p></div><button onClick={showTutorialAgain} className="px-5 py-3 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Mostra tutorial</button></div>
          </section>
        </div>

        <div className="px-6 sm:px-10 py-4 sm:py-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
          <button onClick={() => setDraftSettings(DEFAULT_SETTINGS)} className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors">Ripristina default</button>
          <button onClick={saveSettings} className="px-10 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs">Salva modifiche</button>
        </div>
      </div>
    </div>
  );
}
