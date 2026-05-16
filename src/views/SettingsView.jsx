import { useEffect, useMemo, useState } from 'react';

const DEFAULT_SETTINGS = {
  theme: 'dark', units: 'metric', crsOverride: false,
  crsCode: 'EPSG:4326',
  crsName: 'WGS 84',
  crsProj4: '+proj=longlat +datum=WGS84 +no_defs',
  crsSource: 'fallback',
  gpu: true, logLevel: 'low', compassMode: false
};

const FALLBACK_CRS_OPTIONS = [
  { code: 'EPSG:4326', name: 'WGS 84', proj4: '+proj=longlat +datum=WGS84 +no_defs', source: 'fallback' },
  { code: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs', source: 'fallback' },
  { code: 'EPSG:32632', name: 'WGS 84 / UTM zone 32N', proj4: '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:32633', name: 'WGS 84 / UTM zone 33N', proj4: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:25832', name: 'ETRS89 / UTM zone 32N', proj4: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:25833', name: 'ETRS89 / UTM zone 33N', proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:3003', name: 'Monte Mario / Italy zone 1', proj4: '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:3004', name: 'Monte Mario / Italy zone 2', proj4: '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9996 +x_0=2520000 +y_0=0 +ellps=intl +units=m +no_defs', source: 'fallback' },
  { code: 'EPSG:6706', name: 'RDN2008', proj4: '+proj=longlat +ellps=GRS80 +no_defs', source: 'fallback' },
  { code: 'EPSG:7791', name: 'RDN2008 / UTM zone 32N', proj4: 'Definition stored as EPSG metadata only.', source: 'fallback' },
];

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={onChange}
      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${value ? 'bg-primary' : 'bg-white/10'}`}
    >
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
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${value === o.value ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

function normalizeEpsg(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const digits = raw.replace('EPSG:', '').replace(/[^0-9]/g, '');
  return digits ? `EPSG:${digits}` : raw;
}

function makeMetadataOnlyCrs(value) {
  const code = normalizeEpsg(value) || 'EPSG:4326';
  return {
    code,
    name: 'EPSG metadata only / online definition not loaded',
    proj4: 'Definition not bundled. Stored as CRS metadata only.',
    source: 'manual'
  };
}

function normalizeApiResult(item) {
  const code = item?.code ? `EPSG:${String(item.code).replace('EPSG:', '')}` : normalizeEpsg(item?.auth_name && item?.auth_code ? `${item.auth_name}:${item.auth_code}` : item?.id);
  if (!code) return null;
  return {
    code,
    name: item?.name || item?.title || item?.area || 'Unnamed CRS',
    proj4: item?.proj4 || item?.proj4text || item?.proj4_definition || 'Definition not returned by registry. Stored as CRS metadata only.',
    source: 'epsg.io'
  };
}

async function searchEpsgRegistry(query, signal) {
  const q = String(query || '').trim();
  if (!q) return [];

  const normalized = normalizeEpsg(q);
  const searchTerm = normalized.startsWith('EPSG:') ? normalized.replace('EPSG:', '') : q;
  const url = `https://epsg.io/?format=json&q=${encodeURIComponent(searchTerm)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`EPSG registry error ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  const seen = new Set();
  return results
    .map(normalizeApiResult)
    .filter(Boolean)
    .filter(crs => {
      if (seen.has(crs.code)) return false;
      seen.add(crs.code);
      return true;
    })
    .slice(0, 30);
}

export default function SettingsView({ draftSettings, setDraftSettings, saveSettings, showTutorialAgain }) {
  const s = draftSettings;
  const set = (key, val) => setDraftSettings(prev => ({ ...prev, [key]: val }));
  const [crsResults, setCrsResults] = useState([]);
  const [crsLoading, setCrsLoading] = useState(false);
  const [crsError, setCrsError] = useState('');

  const activeCrs = useMemo(() => {
    const code = s.crsCode || 'EPSG:4326';
    const known = [...crsResults, ...FALLBACK_CRS_OPTIONS].find(c => c.code === code);
    return known || {
      code,
      name: s.crsName || 'Custom CRS',
      proj4: s.crsProj4 || 'Definition not bundled. Stored as CRS metadata only.',
      source: s.crsSource || 'saved'
    };
  }, [s.crsCode, s.crsName, s.crsProj4, s.crsSource, crsResults]);

  const filteredFallbackOptions = useMemo(() => {
    const q = String(s.crsSearch || '').trim().toLowerCase();
    if (!q) return FALLBACK_CRS_OPTIONS;
    return FALLBACK_CRS_OPTIONS.filter(crs => crs.code.toLowerCase().includes(q) || crs.name.toLowerCase().includes(q));
  }, [s.crsSearch]);

  const dropdownOptions = crsResults.length > 0 ? crsResults : filteredFallbackOptions;

  const setCrs = (crsOrValue) => {
    const crs = typeof crsOrValue === 'object' ? crsOrValue : ([...crsResults, ...FALLBACK_CRS_OPTIONS].find(c => c.code === normalizeEpsg(crsOrValue)) || makeMetadataOnlyCrs(crsOrValue));
    setDraftSettings(prev => ({
      ...prev,
      crsOverride: true,
      crsCode: crs.code,
      crsName: crs.name,
      crsProj4: crs.proj4,
      crsSource: crs.source || 'manual',
      crsSearch: crs.code
    }));
  };

  const runCrsSearch = async (query = s.crsSearch) => {
    const q = String(query || '').trim();
    if (!q) {
      setCrsResults([]);
      setCrsError('');
      return;
    }
    const controller = new AbortController();
    setCrsLoading(true);
    setCrsError('');
    try {
      const results = await searchEpsgRegistry(q, controller.signal);
      setCrsResults(results);
      if (results.length === 0) setCrsError('Nessun CRS trovato nel registro online. Puoi comunque applicare il codice come metadata.');
    } catch (err) {
      setCrsResults([]);
      setCrsError('Ricerca online non disponibile. Uso lista locale ridotta o metadata EPSG manuale.');
    } finally {
      setCrsLoading(false);
    }
  };

  useEffect(() => {
    const q = String(s.crsSearch || '').trim();
    if (q.length < 2) {
      setCrsResults([]);
      setCrsError('');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setCrsLoading(true);
      setCrsError('');
      try {
        const results = await searchEpsgRegistry(q, controller.signal);
        setCrsResults(results);
        if (results.length === 0) setCrsError('Nessun CRS trovato nel registro online.');
      } catch (err) {
        if (err.name !== 'AbortError') {
          setCrsResults([]);
          setCrsError('Ricerca online non disponibile. Uso fallback locale.');
        }
      } finally {
        setCrsLoading(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [s.crsSearch]);

  return (
    <div className="w-full max-w-4xl h-full flex flex-col items-center animate-in fade-in duration-500 pointer-events-auto">
      <div className="mb-4 sm:mb-6 mt-2 sm:mt-4 w-full text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.25em]">Settings</h2>
      </div>

      <div className="flex-1 w-full glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-10">

          {/* ── CRS ── */}
          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />} title="Coordinate Reference" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Active Project CRS</p>
                  <p className="text-base font-bold text-primary font-mono">{activeCrs.code}</p>
                  <p className="text-[10px] text-slate-400">{activeCrs.name}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Source: {activeCrs.source || 'saved'}</p>
                  <p className="text-[9px] text-emerald-400/70 mt-1">CRS reale attivo per coordinate, misure ed export quando la formula è supportata. Gli EPSG non riconosciuti restano metadata.</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 p-3">
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase">Project CRS Override</p>
                    <p className="text-[9px] text-slate-500">Enable project CRS for coordinates, measures and export</p>
                  </div>
                  <Toggle value={s.crsOverride} onChange={() => set('crsOverride', !s.crsOverride)} />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-white uppercase">Search all EPSG CRS</p>
                  <p className="text-[9px] text-slate-500 mt-1">Type EPSG code or CRS name. Online search uses the EPSG.io registry; supported formulas are applied in-browser.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    value={s.crsSearch || ''}
                    onChange={(e) => set('crsSearch', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runCrsSearch(e.currentTarget.value); }}
                    placeholder="EPSG:4326, 3857, UTM, Rome, WGS 84..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => runCrsSearch(s.crsSearch)}
                    className="px-4 py-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                  >
                    {crsLoading ? 'Search...' : 'Search'}
                  </button>
                </div>
                <select
                  value={dropdownOptions.some(c => c.code === activeCrs.code) ? activeCrs.code : ''}
                  onChange={(e) => {
                    const picked = dropdownOptions.find(c => c.code === e.target.value);
                    if (picked) setCrs(picked);
                  }}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-primary"
                >
                  <option value="" className="bg-[#0f172a] text-white">Select CRS result / {activeCrs.code}</option>
                  {dropdownOptions.map(crs => (
                    <option key={`${crs.source}-${crs.code}`} value={crs.code} className="bg-[#0f172a] text-white">
                      {crs.code} — {crs.name}
                    </option>
                  ))}
                </select>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setCrs(s.crsSearch || activeCrs.code)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Apply typed EPSG
                  </button>
                  <button
                    onClick={() => { setCrsResults([]); set('crsSearch', ''); setCrs(FALLBACK_CRS_OPTIONS[0]); }}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
                  >
                    Reset CRS
                  </button>
                </div>
                {crsError && <p className="text-[9px] text-amber-400/80">{crsError}</p>}
                {crsResults.length > 0 && <p className="text-[9px] text-emerald-400/70">{crsResults.length} online CRS results loaded.</p>}
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Active PROJ Definition / Metadata</p>
              <code className="text-[10px] text-slate-400 font-mono break-all">{activeCrs.proj4}</code>
            </div>
          </section>

          {/* ── Display ── */}
          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />} title="Display" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">UI Theme</p>
                <SegmentControl
                  value={s.theme}
                  onChange={v => set('theme', v)}
                  options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
                />
                <p className="text-[9px] text-amber-400/60">Light theme applied on Save (limited CSS variables)</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Units</p>
                <SegmentControl
                  value={s.units}
                  onChange={v => set('units', v)}
                  options={[{ value: 'metric', label: 'Metric (m, km)' }, { value: 'imperial', label: 'Imperial (ft, mi)' }]}
                />
                <p className="text-[9px] text-slate-600">Affects the Leaflet scale bar</p>
              </div>
            </div>
          </section>

          {/* ── Sensor & Hardware ── */}
          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />} title="Sensors & System" />
            <div className="space-y-1">
              <div
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => set('compassMode', !s.compassMode)}
              >
                <div>
                  <p className="text-xs font-bold text-white uppercase">Compass Mode</p>
                  <p className="text-[10px] text-slate-500">Rotate map based on device heading (requires permission on iOS)</p>
                </div>
                <Toggle value={s.compassMode} onChange={() => set('compassMode', !s.compassMode)} />
              </div>

              <div
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => set('gpu', !s.gpu)}
              >
                <div>
                  <p className="text-xs font-bold text-white uppercase">Hardware Acceleration</p>
                  <p className="text-[10px] text-slate-500">CSS GPU compositing hint for map tiles</p>
                  <p className="text-[9px] text-amber-400/60">Metadata only — actual GPU usage controlled by browser</p>
                </div>
                <Toggle value={s.gpu} onChange={() => set('gpu', !s.gpu)} />
              </div>

              <div
                className="flex justify-between items-center p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => set('logLevel', s.logLevel === 'high' ? 'low' : 'high')}
              >
                <div>
                  <p className="text-xs font-bold text-white uppercase">Debug Logging</p>
                  <p className="text-[10px] text-slate-500">Output verbose logs to browser console</p>
                  <p className="text-[9px] text-slate-600">Current: window.__GIS_DEBUG__ = {String(s.logLevel === 'high')}</p>
                </div>
                <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border transition-colors ${s.logLevel === 'high' ? 'border-primary text-primary bg-primary/10' : 'border-white/10 text-slate-500'}`}>
                  {s.logLevel === 'high' ? 'Verbose' : 'Off'}
                </div>
              </div>
            </div>
          </section>

          {/* ── Help ── */}
          <section>
            <SectionHeader icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.194-.925 2.226-2.263 2.708-.688.248-1.237.826-1.237 1.558V15m-.5 4h.01" />} title="Help" />
            <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white uppercase">Quick Guide</p>
                <p className="text-[10px] text-slate-500 mt-1">Show the first-launch tutorial again.</p>
              </div>
              <button
                onClick={showTutorialAgain}
                className="px-5 py-3 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
              >
                Show Tutorial Again
              </button>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 sm:px-10 py-4 sm:py-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
          <button
            onClick={() => setDraftSettings(DEFAULT_SETTINGS)}
            className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >Reset to Default</button>
          <button
            onClick={saveSettings}
            className="px-10 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs"
          >Save Changes</button>
        </div>
      </div>
    </div>
  );
}
