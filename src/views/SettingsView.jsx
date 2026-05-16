const DEFAULT_SETTINGS = {
  theme: 'dark', units: 'metric', crsOverride: false,
  crsCode: 'EPSG:4326',
  crsName: 'WGS 84',
  crsProj4: '+proj=longlat +datum=WGS84 +no_defs',
  gpu: true, logLevel: 'low', compassMode: false
};

const CRS_OPTIONS = [
  { code: 'EPSG:4326', name: 'WGS 84', proj4: '+proj=longlat +datum=WGS84 +no_defs' },
  { code: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', proj4: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs' },
  { code: 'EPSG:4258', name: 'ETRS89', proj4: '+proj=longlat +ellps=GRS80 +no_defs' },
  { code: 'EPSG:25832', name: 'ETRS89 / UTM zone 32N', proj4: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs' },
  { code: 'EPSG:25833', name: 'ETRS89 / UTM zone 33N', proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs' },
  { code: 'EPSG:32632', name: 'WGS 84 / UTM zone 32N', proj4: '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs' },
  { code: 'EPSG:32633', name: 'WGS 84 / UTM zone 33N', proj4: '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs' },
  { code: 'EPSG:3003', name: 'Monte Mario / Italy zone 1', proj4: '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +units=m +no_defs' },
  { code: 'EPSG:3004', name: 'Monte Mario / Italy zone 2', proj4: '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9996 +x_0=2520000 +y_0=0 +ellps=intl +units=m +no_defs' },
  { code: 'EPSG:6706', name: 'RDN2008', proj4: '+proj=longlat +ellps=GRS80 +no_defs' },
  { code: 'EPSG:6875', name: 'RDN2008 / Italy zone', proj4: '+proj=tmerc +lat_0=0 +lon_0=12 +k=0.9985 +x_0=7000000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  { code: 'EPSG:3035', name: 'ETRS89-extended / LAEA Europe', proj4: '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs' },
  { code: 'EPSG:3034', name: 'ETRS89-extended / LCC Europe', proj4: '+proj=lcc +lat_0=52 +lon_0=10 +lat_1=35 +lat_2=65 +x_0=4000000 +y_0=2800000 +ellps=GRS80 +units=m +no_defs' },
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

function resolveCrs(value) {
  const code = normalizeEpsg(value);
  const known = CRS_OPTIONS.find(c => c.code === code);
  if (known) return known;
  return {
    code,
    name: 'Custom / EPSG lookup required',
    proj4: 'Definition not bundled. Stored as CRS metadata only.'
  };
}

export default function SettingsView({ draftSettings, setDraftSettings, saveSettings, showTutorialAgain }) {
  const s = draftSettings;
  const set = (key, val) => setDraftSettings(prev => ({ ...prev, [key]: val }));
  const activeCrs = resolveCrs(s.crsCode || 'EPSG:4326');
  const matchingCrsOptions = CRS_OPTIONS.filter(crs => {
    const q = String(s.crsSearch || '').trim().toLowerCase();
    if (!q) return true;
    return crs.code.toLowerCase().includes(q) || crs.name.toLowerCase().includes(q);
  });
  const setCrs = (value) => {
    const crs = resolveCrs(value);
    setDraftSettings(prev => ({
      ...prev,
      crsOverride: true,
      crsCode: crs.code,
      crsName: crs.name,
      crsProj4: crs.proj4
    }));
  };

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
                  <p className="text-[9px] text-amber-400/60 mt-1">Stored as project CRS metadata. Geometry coordinates remain browser GeoJSON lon/lat unless reprojection is implemented.</p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-black/20 border border-white/5 p-3">
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase">Project CRS Override</p>
                    <p className="text-[9px] text-slate-500">Enable selected CRS metadata</p>
                  </div>
                  <Toggle value={s.crsOverride} onChange={() => set('crsOverride', !s.crsOverride)} />
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-white uppercase">Search EPSG</p>
                  <p className="text-[9px] text-slate-500 mt-1">Type an EPSG code or search the bundled CRS list.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    value={s.crsSearch || ''}
                    onChange={(e) => set('crsSearch', e.target.value)}
                    placeholder="EPSG:4326, 3857, UTM, Italy..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => setCrs(s.crsSearch || activeCrs.code)}
                    className="px-4 py-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                  >
                    Apply
                  </button>
                </div>
                <select
                  value={CRS_OPTIONS.some(c => c.code === activeCrs.code) ? activeCrs.code : ''}
                  onChange={(e) => setCrs(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-primary"
                >
                  <option value="" className="bg-[#0f172a] text-white">Custom / {activeCrs.code}</option>
                  {matchingCrsOptions.map(crs => (
                    <option key={crs.code} value={crs.code} className="bg-[#0f172a] text-white">
                      {crs.code} — {crs.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <p className="text-[9px] font-bold text-slate-600 uppercase mb-1">Active PROJ Definition</p>
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

              {/* Compass Mode */}
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

              {/* Hardware Acceleration */}
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

              {/* Log Verbosity */}
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
