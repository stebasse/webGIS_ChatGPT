import React, { useState, useEffect, useCallback } from 'react';
import { BASEMAPS } from '../config/constants';
import { FALLBACK_CRS } from '../services/crsService';

export default function ExploreHUD({
  showGrid, setShowGrid, activeBasemap, setActiveBasemap,
  gpsState, locateMe,
  drawingMode, finishDrawing,
  draftCoordinatesCount = 0,
  undoDraftVertex,
  clearDraftFeature,
  mapBearing, setMapBearing,
  gridScaleMeters,
  onAddFeature,
  layers, selectedLayerId, units,
  map,
  isFreehandMode, setIsFreehandMode,
  pointTapMode, setPointTapMode,
  measureMode,
  measureCoordinates,
  measureResult,
  toggleMeasureMode,
  clearMeasure,
  gpsCoordinateLabel,
  projectCrs,
  projectCrsInfo,
  onProjectCrsChange,
  onSelectedLayerChange,
  onGoToCoordinate,
  setActiveTab,
  scaleLocked,
  lockedScaleDenominator,
  toggleScaleLock,
  setManualScale
}) {
  const [gridPosition, setGridPosition] = useState('center');
  const [showGoTo, setShowGoTo] = useState(false);
  const [goToValues, setGoToValues] = useState({ x: '', y: '', crs: projectCrs || 'EPSG:4326' });
  const [showScaleInput, setShowScaleInput] = useState(false);
  const [scaleInputValue, setScaleInputValue] = useState('1:10000');
  const [openStatusMenu, setOpenStatusMenu] = useState(null);
  const [statusMenusLocked, setStatusMenusLocked] = useState(false);

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
  const hasSelectableLayers = Array.isArray(layers) && layers.length > 0;
  const crsOptions = FALLBACK_CRS.some(crs => crs.code === projectCrs)
    ? FALLBACK_CRS
    : [{ code: projectCrs || 'EPSG:4326', name: 'CRS selezionato' }, ...FALLBACK_CRS];
  const basemapIsDark = activeBasemap === 'carto_dark' || activeBasemap === 'satellite';
  const activeLayerIsPoint = !!activeLayer?.type?.includes('Point');

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

      {/* ── Layer / CRS status badges ─────────────────────────────────────── */}
      <div className="fixed top-[calc(0.45rem+env(safe-area-inset-top,0px))] left-4 right-4 sm:left-6 sm:right-6 flex items-start justify-between gap-3 pointer-events-none z-[95]">
        <div className="relative min-w-0 w-[48vw] sm:w-64 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (statusMenusLocked) return;
              setOpenStatusMenu(openStatusMenu === 'layer' ? null : 'layer');
            }}
            className={`w-full text-left glass bg-slate-950/85 backdrop-blur-xl px-3 py-1.5 rounded-2xl border flex items-center gap-2 shadow-2xl transition-colors ${activeLayer ? 'border-white/20 hover:border-primary/60' : 'border-amber-500/40 hover:border-amber-400'} ${statusMenusLocked ? 'opacity-80 cursor-not-allowed' : ''}`}
            title={!hasSelectableLayers ? 'Aggiungi layer' : statusMenusLocked ? 'Menu bloccati' : 'Cambia layer attivo'}
          >
            {activeLayer ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeLayer.colorHex || '#0ea5e9' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[7px] text-slate-400 uppercase tracking-widest leading-none">Layer attivo</div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-widest truncate">{activeLayer.name}</div>
                </div>
              </>
            ) : (
              <>
                <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={hasSelectableLayers ? "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" : "M12 4v16m8-8H4"} /></svg>
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest flex-1">{hasSelectableLayers ? 'Nessun layer' : 'Aggiungi layer'}</span>
              </>
            )}
            <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {openStatusMenu === 'layer' && !statusMenusLocked && (
            <div className="absolute left-0 top-full mt-1 w-full max-h-48 overflow-y-auto no-scrollbar glass bg-slate-950/95 border border-white/20 rounded-2xl shadow-2xl p-1">
              {hasSelectableLayers ? layers.map(layer => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => { onSelectedLayerChange?.(layer.id); setOpenStatusMenu(null); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${selectedLayerId === layer.id ? 'bg-primary/20 text-primary' : 'text-white hover:bg-white/10'}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: layer.colorHex || '#0ea5e9' }} />
                  <span className="min-w-0 flex-1 truncate text-[9px] font-bold uppercase tracking-widest">{layer.name}</span>
                </button>
              )) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setActiveTab?.('new-layer'); setOpenStatusMenu(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-white hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-3 h-3 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    <span className="min-w-0 flex-1 truncate text-[9px] font-bold uppercase tracking-widest">Nuovo layer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab?.('upload'); setOpenStatusMenu(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-white hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-3 h-3 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l-4 4m4-4l4 4" /></svg>
                    <span className="min-w-0 flex-1 truncate text-[9px] font-bold uppercase tracking-widest">Carica layer</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="pointer-events-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setStatusMenusLocked(prev => {
                const next = !prev;
                if (next) setOpenStatusMenu(null);
                return next;
              });
            }}
            className={`glass bg-slate-950/85 backdrop-blur-xl w-9 h-9 rounded-2xl border flex items-center justify-center shadow-2xl transition-colors ${statusMenusLocked ? 'border-primary/60 text-primary' : 'border-white/20 text-slate-400 hover:text-white hover:border-primary/60'}`}
            title={statusMenusLocked ? 'Sblocca menu CRS e layer' : 'Blocca menu CRS e layer'}
            aria-pressed={statusMenusLocked}
          >
            {statusMenusLocked ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 017.874-1M5 11h12a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg>
            )}
          </button>
        </div>
        <div className="relative w-[42vw] sm:w-52 pointer-events-auto">
          <button
            type="button"
            onClick={() => { if (statusMenusLocked) return; setOpenStatusMenu(openStatusMenu === 'crs' ? null : 'crs'); }}
            className={`w-full glass bg-slate-950/85 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/20 text-right shadow-2xl hover:border-primary/60 transition-colors ${statusMenusLocked ? 'opacity-80 cursor-not-allowed' : ''}`}
            title={statusMenusLocked ? 'Menu bloccati' : 'Cambia CRS progetto'}
          >
            <div className="flex items-center justify-end gap-2">
              <div className="min-w-0">
                <div className="text-[7px] text-slate-400 uppercase tracking-widest leading-none">CRS progetto</div>
                <div className="text-[9px] font-mono font-bold text-primary truncate">{projectCrs || 'EPSG:4326'}</div>
              </div>
              <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </button>
          {openStatusMenu === 'crs' && !statusMenusLocked && (
            <div className="absolute right-0 top-full mt-1 w-full max-h-48 overflow-y-auto no-scrollbar glass bg-slate-950/95 border border-white/20 rounded-2xl shadow-2xl p-1">
              {crsOptions.map(crs => (
                <button
                  key={crs.code}
                  type="button"
                  onClick={() => { onProjectCrsChange?.(crs.code); setGoToValues(prev => ({ ...prev, crs: crs.code })); setOpenStatusMenu(null); }}
                  className={`w-full px-2.5 py-2 rounded-xl text-right transition-colors ${projectCrs === crs.code ? 'bg-primary/20 text-primary' : 'text-white hover:bg-white/10'}`}
                >
                  <span className="block text-[9px] font-mono font-bold truncate">{crs.code}</span>
                  <span className="block text-[7px] text-slate-500 truncate">{crs.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top control panel ────────────────────────────────────────────── */}
      <div className="absolute top-[calc(4.6rem+env(safe-area-inset-top,0px))] left-4 right-4 sm:left-6 sm:right-auto glass px-2 sm:px-5 py-2 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-between sm:justify-start gap-2 sm:gap-4 border border-white/20 shadow-2xl pointer-events-auto max-w-full sm:max-w-max overflow-x-auto no-scrollbar">

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
        <button
          type="button"
          onClick={() => setShowGrid(!showGrid)}
          className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all flex-shrink-0 ${showGrid ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
          title={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
          aria-label={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
          aria-pressed={showGrid}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16" />
          </svg>
        </button>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Strumento misura */}
        <button
          onClick={toggleMeasureMode}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 ${measureMode ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
          title="Misura distanza / area"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8M5 19h14" /></svg>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest hidden xs:inline">{measureMode || 'Misura'}</span>
        </button>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Vai a coordinates */}
        <button
          onClick={() => { setShowGoTo(v => !v); setGoToValues(prev => ({ ...prev, crs: projectCrs || prev.crs || 'EPSG:4326' })); }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all flex-shrink-0 ${showGoTo ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
          title="Vai a coordinate"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l7 19-7-4-7 4 7-19z" /></svg>
          <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest hidden xs:inline">Vai a</span>
        </button>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Scale indicator + scale lock */}
        <div className="flex items-center gap-1.5 flex-shrink-0 rounded-2xl px-1 py-0.5">
          <div className="flex flex-col gap-0.5 w-[118px] sm:w-[128px]">
            <div className="flex justify-between items-end w-full border-b-2 border-white/40 h-1.5">
              <div className="w-0.5 h-full bg-white/40" />
              <div className="w-0.5 h-full bg-white/40" />
            </div>
            <span className="text-[7px] sm:text-[9px] font-bold text-white tracking-widest uppercase text-center mt-0.5 shadow-sm leading-none">
              {formatDistance(gridScaleMeters)}
            </span>
            {scaleLocked && lockedScaleDenominator && (
              <span className="text-[6px] sm:text-[7px] font-bold text-primary tracking-widest uppercase text-center leading-none">
                LOCK 1:{lockedScaleDenominator}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (scaleLocked) {
                toggleScaleLock?.();
                setShowScaleInput(false);
              } else {
                setScaleInputValue(lockedScaleDenominator ? `1:${lockedScaleDenominator}` : '1:10000');
                setShowScaleInput(v => !v);
              }
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center transition-all shrink-0 ${scaleLocked ? 'bg-primary/25 border-primary text-primary shadow-[0_0_14px_rgba(0,191,255,0.25)]' : showScaleInput ? 'bg-primary/15 border-primary/70 text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/30'}`}
            title={scaleLocked ? 'Scala bloccata. Tocca per sbloccare.' : 'Imposta e blocca scala, es. 1:10000'}
            aria-label={scaleLocked ? 'Sblocca scala mappa' : 'Imposta scala mappa'}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {scaleLocked ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 10V7a4 4 0 00-8 0v3M6 10h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zm6 4v3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10V7a4 4 0 117.45 2.03M6 10h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zm6 4v3" />
              )}
            </svg>
          </button>
        </div>

        <div className="w-px h-3 bg-white/10 flex-shrink-0" />

        {/* Compass & GPS - Grouped for mobile */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setMapBearing(0)}
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-white/10 transition-colors"
            title="Reimposta nord"
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
        <div className="absolute top-[calc(4.0rem+env(safe-area-inset-top,0px))] left-4 sm:left-6 pointer-events-auto glass p-4 rounded-2xl border border-white/15 shadow-2xl w-[min(92vw,320px)] space-y-3 z-[100]">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest">Vai a coordinate</p>
              <p className="text-[8px] text-slate-500">Inserisci coordinate nel CRS selezionato</p>
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

      {showScaleInput && !scaleLocked && (
        <div className="absolute top-[calc(5.0rem+env(safe-area-inset-top,0px))] left-4 sm:left-6 z-30 pointer-events-auto glass rounded-2xl border border-white/15 shadow-2xl p-3 w-[min(92vw,280px)]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-2">Blocca scala</div>
          <div className="flex items-center gap-2">
            <input
              value={scaleInputValue}
              onChange={(e) => setScaleInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setManualScale?.(scaleInputValue); setShowScaleInput(false); } }}
              placeholder="1:10000"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
            />
            <button
              onClick={() => { setManualScale?.(scaleInputValue); setShowScaleInput(false); }}
              className="px-3 py-2 rounded-xl bg-primary text-white text-[9px] font-bold uppercase tracking-widest"
            >
              Lock
            </button>
          </div>
          <p className="mt-2 text-[8px] text-white/40 leading-snug">La distanza della scala resta visibile; zoom e pinch sono bloccati fino allo sblocco.</p>
        </div>
      )}


      {/* ── Finish Drawing banner ────────────────────────────────────────── */}
      {drawingMode && (
        <div className="absolute bottom-24 sm:bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 max-w-[96vw] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setIsFreehandMode(!isFreehandMode)}
            className={`glass flex items-center gap-2 px-4 py-2.5 rounded-[2rem] border transition-all text-[9px] font-bold uppercase tracking-widest flex-shrink-0 ${isFreehandMode ? 'bg-primary/40 border-primary text-white shadow-[0_0_15px_rgba(0,191,255,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
            Mano libera
          </button>
          <button
            onClick={undoDraftVertex}
            disabled={draftCoordinatesCount <= 0}
            className="glass flex items-center gap-2 px-4 py-2.5 rounded-[2rem] bg-white/5 border border-white/10 text-slate-300 font-bold uppercase tracking-widest text-[9px] hover:border-primary hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-all flex-shrink-0"
            title="Annulla ultimo vertice"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 14L4 9m0 0l5-5M4 9h11a5 5 0 010 10h-1" /></svg>
            Annulla
          </button>
          <button
            onClick={clearDraftFeature}
            className="glass flex items-center gap-2 px-4 py-2.5 rounded-[2rem] bg-red-500/15 border border-red-500/40 text-red-300 font-bold uppercase tracking-widest text-[9px] hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
            title="Elimina la feature in creazione"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            Elimina
          </button>
          <button
            onClick={finishDrawing}
            className="glass flex items-center gap-2 px-5 py-2.5 rounded-[2rem] bg-emerald-500/20 border border-emerald-500 shadow-lg text-emerald-400 font-bold uppercase tracking-widest text-[9px] hover:bg-emerald-500 hover:text-white transition-all flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            Completa {drawingMode === 'Line' ? 'linea' : 'poligono'}
          </button>
        </div>
      )}

      {/* ── Point tap placement control ───────────────────────────── */}
      {activeLayerIsPoint && !drawingMode && !measureMode && (
        <div className="absolute bottom-24 sm:bottom-32 left-1/2 -translate-x-1/2 pointer-events-auto z-[90] flex items-center gap-2 max-w-[96vw] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setPointTapMode?.(!pointTapMode)}
            className={`glass flex items-center gap-2 px-4 py-2.5 rounded-[2rem] border transition-all text-[9px] font-bold uppercase tracking-widest flex-shrink-0 ${pointTapMode ? 'bg-primary/40 border-primary text-white shadow-[0_0_15px_rgba(0,191,255,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
            title={pointTapMode ? 'Disattiva inserimento punti da mappa' : 'Attiva inserimento punti da mappa'}
            aria-pressed={pointTapMode}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" /><circle cx="12" cy="9" r="2.5" fill="currentColor" /></svg>
            {pointTapMode ? 'Tap point attivo' : 'Tap point'}
          </button>
        </div>
      )}

      {/* ── Point tap mode banner ───────────────────────────────────── */}
      {pointTapMode && !activeLayerIsPoint && !drawingMode && !measureMode && (
        <div className="absolute bottom-24 sm:bottom-32 left-4 sm:left-6 pointer-events-auto">
          <div className="glass px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[8px] font-bold text-amber-300 uppercase tracking-widest">Tap point</div>
              <div className="text-xs font-mono text-white">seleziona un layer puntuale</div>
            </div>
            <button onClick={() => setPointTapMode?.(false)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-400/20 text-white/50 hover:text-red-300 transition-all" title="Disattiva aggiunta punti">
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Risultato misura ───────────────────────────────────── */}
      {measureMode && (
        <div className="absolute bottom-24 sm:bottom-32 right-4 sm:right-6 pointer-events-auto">
          <div className="glass px-4 py-2.5 rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-xl flex items-center gap-3">
            <div>
              <div className="text-[8px] font-bold text-amber-300 uppercase tracking-widest">{measureMode}</div>
              <div className="text-xs font-mono text-white">{measureResult || (measureMode === 'Area' ? 'min 3 punti' : 'clicca sulla mappa')}</div>
              <div className="text-[7px] text-white/35 uppercase tracking-widest">{measureCoordinates.length} nodi</div>
            </div>
            <button onClick={clearMeasure} className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-400/20 text-white/50 hover:text-red-300 transition-all" title="Cancella misura">
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
