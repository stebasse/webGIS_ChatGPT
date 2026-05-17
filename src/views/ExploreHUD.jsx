import React, { useState, useEffect, useCallback } from 'react';
import { BASEMAPS } from '../config/constants';

export default function ExploreHUD({
  showGrid, setShowGrid, activeBasemap, setActiveBasemap,
  gpsState, locateMe,
  drawingMode, finishDrawing,
  mapBearing, setMapBearing,
  gridScaleMeters,
  onAddFeature,
  layers, selectedLayerId, units,
  map,
  isFreehandMode, setIsFreehandMode,
  measureMode,
  measureCoordinates,
  measureResult,
  toggleMeasureMode,
  clearMeasure,
  gpsCoordinateLabel,
  projectCrs,
  projectCrsInfo,
  onGoToCoordinate,
  scaleLocked,
  lockedScaleDenominator,
  toggleScaleLock,
  setManualScale
}) {
  const [gridPosition, setGridPosition] = useState('center');
  const [showGoTo, setShowGoTo] = useState(false);
  const [goToValues, setGoToValues] = useState({ x: '', y: '', crs: projectCrs || 'EPSG:4326' });

  const updateGridPos = useCallback(() => {
    if (!map) return;
    if (gpsState?.position) {
      const pos = { lat: gpsState.position[1], lng: gpsState.position[0] };
      const pixel = map.latLngToContainerPoint(pos);
      setGridPosition(`${pixel.x - 64}px ${pixel.y - 64}px`);
    } else {
      setGridPosition('center');
    }
  }, [map, gpsState?.position]);

  useEffect(() => {
    if (!map || !showGrid) return;
    updateGridPos();
    map.on('move zoom rotate', updateGridPos);
    return () => map.off('move zoom rotate', updateGridPos);
  }, [map, showGrid, updateGridPos]);

  const activeLayer = layers?.find(l => l.id === selectedLayerId);
  const basemapIsDark = activeBasemap === 'carto_dark' || activeBasemap === 'satellite';

  const formatDistance = (m) => {
    if (!m || m <= 0) return '—';
    if (units === 'imperial') {
      const ft = m * 3.28084;
      return ft >= 5280 ? `${(ft / 5280).toFixed(1)} mi` : `${Math.round(ft)} ft`;
    }
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  };

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500 pointer-events-none">

      {/* Grid overlay */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-40"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='128' height='128' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M64 60 v8 M60 64 h8' stroke='${(activeBasemap === 'osm') ? 'black' : 'white'}' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
            backgroundPosition: gridPosition
          }}
        />
      )}

      {/* ── Top control panel ────────────────────────────────────────────── */}
      <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] left-4 right-4 sm:left-6 sm:right-auto glass px-2 sm:px-5 py-2 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-between sm:justify-start gap-2 sm:gap-4 border border-white/20 shadow-2xl pointer-events-auto max-w-full sm:max-w-max overflow-x-auto no-scrollbar">

        {/* Basemap selector */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <select
            value={activeBasemap}
            onChange={(e) => setActiveBasemap(e.target.value)}
            className="bg-transparent text-[8px] sm:text-[10px] font-bold text-white uppercase tracking-widest outline-none cursor-pointer appearance-none"
          >
            {Object.entries(BASEMAPS).map(([key, map]) => (
              <option key={key} value={key} className="bg-[#0f172a] text-white normal-case">{map.name}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Grid toggle */}
        <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group flex-shrink-0">
          <div className="relative">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="sr-only" />
            <div className={`w-7 sm:w-9 h-4 sm:h-5 rounded-full border border-white/20 transition-all ${showGrid ? 'bg-primary border-primary' : 'bg-white/5'}`} />
            <div className={`absolute top-0.5 sm:top-1 left-0.5 sm:left-1 w-3 h-3 bg-white rounded-full transition-all ${showGrid ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-[8px] sm:text-[10px] font-bold text-white/50 uppercase tracking-widest group-hover:text-white transition-colors hidden xs:inline">Grid</span>
        </label>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Measure tool */}
        <button
          onClick={toggleMeasureMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 ${measureMode ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
          title="Measure distance / area"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8M5 19h14" /></svg>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest hidden xs:inline">{measureMode || 'Measure'}</span>
        </button>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Go To coordinates */}
        <button
          onClick={() => { setShowGoTo(v => !v); setGoToValues(prev => ({ ...prev, crs: projectCrs || prev.crs || 'EPSG:4326' })); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 ${showGoTo ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
          title="Go To Coordinates"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l7 19-7-4-7 4 7-19z" /></svg>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest hidden xs:inline">Go To</span>
        </button>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Scale indicator + scale lock */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col gap-0.5 w-[128px]">
            <div className="flex justify-between items-end w-full border-b-2 border-white/40 h-1.5">
              <div className="w-0.5 h-full bg-white/40" />
              <div className="w-0.5 h-full bg-white/40" />
            </div>
            <span className="text-[7px] sm:text-[9px] font-bold text-white tracking-widest uppercase text-center mt-0.5 shadow-sm">
              {scaleLocked && lockedScaleDenominator ? `1:${lockedScaleDenominator}` : formatDistance(gridScaleMeters)}
            </span>
          </div>
          <button
            onClick={toggleScaleLock}
            onContextMenu={(e) => { e.preventDefault(); const v = window.prompt('Inserisci scala, es. 1:10000', lockedScaleDenominator ? `1:${lockedScaleDenominator}` : '1:10000'); if (v) setManualScale?.(v); }}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${scaleLocked ? 'bg-primary/25 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
            title={scaleLocked ? 'Scala bloccata. Tocca per sbloccare.' : 'Fissa scala manuale'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Compass & GPS - Grouped for mobile */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setMapBearing(0)}
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-white/10 transition-colors"
            title="Reset North"
          >
            <div
              className="flex flex-col items-center justify-center transition-transform duration-150"
              style={{ transform: `rotate(${-mapBearing}deg)` }}
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L9 12h6L12 2z" /></svg>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white/40 -mt-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22l3-10H9l3 10z" /></svg>
            </div>
          </button>

          <button
            onClick={locateMe}
            className={`relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all ${gpsState.tracking ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:bg-white/10 hover:text-white'}`}
            title="GPS"
          >
            <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${gpsState.tracking ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" />
              <circle cx="12" cy="9" r="2.5" fill="currentColor" />
            </svg>
            {gpsState.position && (
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_4px_rgba(52,211,153,0.9)]" />
            )}
          </button>
        </div>
      </div>

      {showGoTo && (
        <div className="absolute top-[calc(4.25rem+env(safe-area-inset-top,0px))] left-4 sm:left-6 pointer-events-auto glass p-4 rounded-2xl border border-white/15 shadow-2xl w-[min(92vw,320px)] space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest">Go To Coordinates</p>
              <p className="text-[8px] text-slate-500">Input coordinates in selected CRS</p>
            </div>
            <button onClick={() => setShowGoTo(false)} className="text-slate-500 hover:text-white">×</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={goToValues.x} onChange={e => setGoToValues(v => ({ ...v, x: e.target.value }))} placeholder="E / Lon" className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-primary" />
            <input value={goToValues.y} onChange={e => setGoToValues(v => ({ ...v, y: e.target.value }))} placeholder="N / Lat" className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-primary" />
          </div>
          <input value={goToValues.crs} onChange={e => setGoToValues(v => ({ ...v, crs: e.target.value }))} placeholder="EPSG:32632" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-primary" />
          <button onClick={() => onGoToCoordinate?.({ x: goToValues.x, y: goToValues.y, crs: goToValues.crs })} className="w-full px-4 py-2 rounded-xl bg-primary/20 border border-primary/30 text-primary text-[9px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Center Map</button>
        </div>
      )}

      {/* Project CRS badge / lightweight CRS grid label */}
      {projectCrs && (
        <div className="absolute top-[calc(8.2rem+env(safe-area-inset-top,0px))] right-4 sm:right-6 pointer-events-none">
          <div className="glass px-2.5 py-1.5 rounded-xl border border-white/10 text-[8px] font-mono text-primary/80 shadow-xl">
            CRS {projectCrs}{projectCrsInfo?.projected ? ' · projected grid' : ' · geographic'}
          </div>
        </div>
      )}

      {/* ── Active layer indicator ───────────────────────────────────────── */}
      <div className="absolute top-[calc(5rem+env(safe-area-inset-top,0px))] sm:top-6 right-4 sm:right-6 pointer-events-auto">
        {activeLayer ? (
          <div className="glass px-2.5 py-1.5 rounded-[1.2rem] border border-white/15 flex items-center gap-2 shadow-xl">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeLayer.colorHex || '#0ea5e9' }} />
            <span className="text-[8px] font-bold text-white uppercase tracking-widest max-w-[80px] sm:max-w-[120px] truncate">{activeLayer.name}</span>
            <span className="text-[7px] text-slate-500 uppercase hidden xs:inline">{activeLayer.type.replace('Vector - ', '')}</span>
          </div>
        ) : (
          <div className="glass px-2.5 py-1.5 rounded-[1.2rem] border border-amber-500/30 bg-amber-500/10 flex items-center gap-2 shadow-xl">
            <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest">No layer</span>
          </div>
        )}
      </div>

      {/* ── Finish Drawing banner ────────────────────────────────────────── */}
      {drawingMode && (
        <div className="absolute bottom-24 sm:bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setIsFreehandMode(!isFreehandMode)}
            className={`glass flex items-center gap-2 px-4 py-2.5 rounded-[2rem] border transition-all text-[9px] font-bold uppercase tracking-widest ${isFreehandMode ? 'bg-primary/40 border-primary text-white shadow-[0_0_15px_rgba(0,191,255,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            Freehand
          </button>
          <button
            onClick={finishDrawing}
            className="glass flex items-center gap-2 px-5 py-2.5 rounded-[2rem] bg-emerald-500/20 border border-emerald-500 shadow-lg text-emerald-400 font-bold uppercase tracking-widest text-[9px] hover:bg-emerald-500 hover:text-white transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Finish {drawingMode}
          </button>
        </div>
      )}

      {/* ── Measurement result banner ───────────────────────────────────── */}
      {measureMode && (
        <div className="absolute bottom-24 sm:bottom-32 right-4 sm:right-6 pointer-events-auto">
          <div className="glass px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[8px] font-bold text-amber-300 uppercase tracking-widest">{measureMode}</div>
              <div className="text-xs font-mono text-white">{measureResult || (measureMode === 'Area' ? 'min 3 punti' : 'clicca sulla mappa')}</div>
              <div className="text-[7px] text-white/35 uppercase tracking-widest">{measureCoordinates.length} nodi</div>
            </div>
            <button onClick={clearMeasure} className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-400/20 text-white/50 hover:text-red-300 transition-all" title="Clear measure">
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── GPS coordinate bubble (when tracking) ───────────────────────── */}
      {gpsState.position && (
        <div className="absolute bottom-24 sm:bottom-32 left-4 sm:left-6 pointer-events-none">
          <div className="glass px-2.5 py-1.5 rounded-xl text-[8px] font-mono text-emerald-400 shadow-xl border border-emerald-500/20">
            <div>{gpsCoordinateLabel || `${gpsState.position[1].toFixed(6)}, ${gpsState.position[0].toFixed(6)}`}</div>
            {gpsState.accuracy && <div className="text-white/30 text-[7px]">±{gpsState.accuracy.toFixed(1)} m · {projectCrs || 'EPSG:4326'}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
