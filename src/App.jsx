import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';

import { BASEMAPS } from './config/constants';
import { useDeviceCompass } from './hooks/useDeviceCompass';
import { useGpsTracking } from './hooks/useGpsTracking';
import { useOnboardingGuide } from './hooks/useOnboardingGuide';
import { useProjectCrs } from './hooks/useProjectCrs';
import { useSettingsDraft } from './hooks/useSettingsDraft';

import MapController from './components/Map/MapController';
import MapEvents from './components/Map/MapEvents';
import { createGpsIcon } from './components/Map/GpsIcon';
import BottomNav from './components/BottomNav';

import ExploreHUD from './views/ExploreHUD';
import LayersView from './views/LayersView';
import AddDataMenu from './views/AddDataMenu';
import NewLayerView from './views/NewLayerView';
import UploadView from './views/UploadView';
import DataTableView from './views/DataTableView';
import SettingsView from './views/SettingsView';
import { t } from './i18n';
import OnboardingGuide from './components/OnboardingGuide';
import { transformCoord, formatCoordinate, getCrsCode } from './services/crsService';
import { FIELD_TYPES, EMPTY_NEW_LAYER, EMPTY_NEW_FIELD } from './state/defaults';
import { useProjectState } from './state/useProjectState';
import { resolveFeatureColor } from './services/symbologyService';
import { formatMeasureValue as formatMeasurementValue } from './services/measurementService';
import { buildDefaultProperties, coerceFieldValue, createDraftTableFeature, getDefaultValueForType, getFieldType } from './services/featureService';
import { updateFeatureProperties as patchFeatureProperties } from './domain/gis/featureEngine';
import { useDrawingLegacyState } from './state/drawing/DrawingContext.jsx';
import { exportFeatures } from './services/exportService';
import { getLayerGeometryKind } from './services/layerService';

const goToIcon = new L.DivIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="width:32px;height:32px;border-radius:9999px;background:#f97316;border:3px solid #fff;box-shadow:0 0 18px rgba(249,115,22,.9);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;">+</div>`
});

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [isTocSidebarOpen, setIsTocSidebarOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState('carto_dark');

  const {
    layers,
    setLayers,
    collectedPoints,
    setCollectedPoints,
    settings,
    setSettings,
    selectedLayerId,
    setSelectedLayerId,
  } = useProjectState();

  const [mapBearing, setMapBearing] = useState(0);
  const [gridScaleMeters, setGridScaleMeters] = useState(100);
  const {
    drawingMode,
    setDrawingMode,
    draftCoordinates,
    setDraftCoordinates,
    isFreehandMode,
    setIsFreehandMode,
    pointTapMode,
    setPointTapMode,
    measureMode,
    setMeasureMode,
    measureCoordinates,
    setMeasureCoordinates,
  } = useDrawingLegacyState();
  const [layerFilter, setLayerFilter] = useState('');
  const [newLayer, setNewLayer] = useState(EMPTY_NEW_LAYER);
  const [popupFeature, setPopupFeature] = useState(null);
  const [isEditingPopup, setIsEditingPopup] = useState(false);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);
  const [newPopupField, setNewPopupField] = useState(EMPTY_NEW_FIELD);
  const [goToMarker, setGoToMarker] = useState(null);
  const [scaleLocked, setScaleLocked] = useState(false);
  const [lockedScaleDenominator, setLockedScaleDenominator] = useState(null);

  const { draftSettings, setDraftSettings, language, saveSettings } = useSettingsDraft({
    settings,
    setSettings,
    activeTab,
    onSaved: () => setActiveTab('explore'),
  });

  const { showOnboarding, finishOnboarding, showTutorialAgain } = useOnboardingGuide({
    onReplay: () => setActiveTab('explore'),
  });

  const deviceHeading = useDeviceCompass();
  const {
    projectCrs,
    projectCrsInfo,
    getFeatureSourceCrs,
    geometryToWgs84,
    coordinatesToLayerCrs,
  } = useProjectCrs({ settings, setLayers });

  useEffect(() => {
    if (activeTab !== 'explore') setIsTocSidebarOpen(false);
    if (activeTab !== 'explore') setPointTapMode(false);
  }, [activeTab]);

  const openTocSidebar = () => {
    setActiveTab('explore');
    setIsTocSidebarOpen(prev => !prev);
  };

  const tocLayerIcon = (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3L3 7.5L12 12L21 7.5L12 3Z"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12L12 16.5L21 12"/>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5L12 21L21 16.5"/>
    </svg>
  );

  const toggleLayer = (id) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const deleteLayer = (id) => {
    if (!window.confirm('Eliminare definitivamente questo layer e TUTTE le feature associate?')) return;
    setLayers(prev => prev.filter(l => l.id !== id));
    setCollectedPoints(prev => prev.filter(f => f.properties.layerId !== id));
  };

  // ── GPS ──────────────────────────────────────────────────────────────────
  const [map, setMap] = useState(null);
  const { gpsState, locateMe } = useGpsTracking();

  // ── Measurement state/actions ───────────────────────────────────────────
  const formatMeasureValue = useCallback((mode, coords) => formatMeasurementValue(mode, coords, {
    units: settings.units,
    useProjectCrs: settings.crsOverride,
    projectCrs,
  }), [settings.units, settings.crsOverride, projectCrs]);

  const toggleMeasureMode = () => {
    setDrawingMode(false);
    setIsFreehandMode(false);
    setDraftCoordinates([]);
    setMeasureCoordinates([]);
    setMeasureMode(prev => prev === 'Distance' ? 'Area' : prev === 'Area' ? false : 'Distance');
  };

  const clearMeasure = () => {
    setMeasureMode(false);
    setMeasureCoordinates([]);
  };


  const estimateScaleDenominator = useCallback(() => {
    if (!map) return null;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const metersPerPixel = Math.cos(center.lat * Math.PI / 180) * 2 * Math.PI * 6378137 / (256 * Math.pow(2, zoom));
    return Math.round(metersPerPixel / 0.00028);
  }, [map]);

  const setManualScale = useCallback((scaleText) => {
    if (!map) {
      alert('Mappa non ancora pronta.');
      return;
    }
    const cleaned = String(scaleText || '').replace(/\s/g, '').replace(/^1:/, '');
    const denominator = Number(cleaned);
    if (!Number.isFinite(denominator) || denominator <= 0) {
      alert('Scala non valida. Usa un formato tipo 1:10000.');
      return;
    }
    const center = map.getCenter();
    const zoom = Math.log2(Math.cos(center.lat * Math.PI / 180) * 2 * Math.PI * 6378137 / (256 * denominator * 0.00028));
    const originalMin = Number.isFinite(map.options?.minZoom) ? map.options.minZoom : 0;
    const originalMax = Number.isFinite(map.options?.maxZoom) ? map.options.maxZoom : 22;
    const safeZoom = Math.max(originalMin, Math.min(originalMax, Math.round(zoom)));

    // Release a previous lock before changing zoom, then re-lock at the requested scale.
    map.setMinZoom?.(originalMin);
    map.setMaxZoom?.(originalMax);
    setScaleLocked(false);
    map.setZoom(safeZoom, { animate: false });
    setGridScaleMeters(prev => prev); // keep metric scale visible while the map controller recalculates it
    setLockedScaleDenominator(denominator);
    window.setTimeout(() => setScaleLocked(true), 0);
  }, [map]);

  const toggleScaleLock = useCallback(() => {
    if (scaleLocked) {
      setScaleLocked(false);
      setLockedScaleDenominator(null);
      return;
    }
    const current = estimateScaleDenominator();
    const input = window.prompt('Inserisci scala di visualizzazione, es. 1:10000', current ? `1:${current}` : '1:10000');
    if (input) setManualScale(input);
  }, [scaleLocked, estimateScaleDenominator, setManualScale]);

  const goToCoordinate = ({ x, y, crs }) => {
    const sourceCrs = getCrsCode(crs || projectCrs);
    const lngLat = sourceCrs === 'EPSG:4326' ? [Number(x), Number(y)] : transformCoord([Number(x), Number(y)], sourceCrs, 'EPSG:4326');
    if (!Number.isFinite(lngLat?.[0]) || !Number.isFinite(lngLat?.[1])) {
      alert('Coordinate non valide o CRS non trasformabile.');
      return;
    }
    setGoToMarker(lngLat);
    map?.setView([lngLat[1], lngLat[0]], Math.max(map.getZoom(), 16));
  };

  const createPointFeatureAtPosition = useCallback((position, accuracy = null) => {
    if (layers.length === 0) {
      alert('Nessun layer presente. Crea prima un layer dalla sezione Layer.');
      return false;
    }
    const activeLayer = layers.find(l => l.id === selectedLayerId);
    if (!activeLayer) {
      alert('Nessun layer selezionato. Apri la TOC e seleziona un layer.');
      setActiveTab('explore');
      setIsTocSidebarOpen(true);
      return false;
    }
    const geomKind = getLayerGeometryKind(activeLayer);
    if (geomKind !== 'Point') {
      alert('Seleziona un layer puntuale per aggiungere punti sulla mappa.');
      return false;
    }
    const layerCrs = getCrsCode(activeLayer.crs || 'EPSG:4326');
    const storedPosition = coordinatesToLayerCrs(position, activeLayer);
    const newPoint = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        layerId: selectedLayerId,
        layerName: activeLayer.name,
        sourceCrs: layerCrs,
        timestamp: new Date().toISOString(),
        accuracy,
        ...buildDefaultProperties(activeLayer)
      },
      geometry: { type: 'Point', coordinates: storedPosition }
    };
    setCollectedPoints(prev => [...prev, newPoint]);
    return true;
  }, [layers, selectedLayerId, coordinatesToLayerCrs]);

  const collectPointAtLatLng = useCallback((latlng) => {
    const lng = Array.isArray(latlng) ? latlng[0] : latlng?.lng;
    const lat = Array.isArray(latlng) ? latlng[1] : latlng?.lat;
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    return createPointFeatureAtPosition([lng, lat], null);
  }, [createPointFeatureAtPosition]);

  // ── Map interaction ───────────────────────────────────────────────────────
  const handleAddNode = useCallback((latlng) => {
    if (!latlng) return;
    const lng = Array.isArray(latlng) ? latlng[0] : latlng.lng;
    const lat = Array.isArray(latlng) ? latlng[1] : latlng.lat;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    setDraftCoordinates(prev => {
      const last = prev[prev.length - 1];
      if (last && last[0] === lng && last[1] === lat) return prev;
      return [...prev, [lng, lat]];
    });
  }, []);

  const handleMapClick = useCallback((e) => {
    const latlng = e.latlng || e;
    if (measureMode) {
      const lng = Array.isArray(latlng) ? latlng[0] : latlng.lng;
      const lat = Array.isArray(latlng) ? latlng[1] : latlng.lat;
      if (typeof lat === 'number' && typeof lng === 'number') {
        setMeasureCoordinates(prev => [...prev, [lng, lat]]);
      }
      return;
    }
    if (pointTapMode) {
      collectPointAtLatLng(latlng);
      return;
    }
    if (drawingMode && !isFreehandMode) {
      handleAddNode(latlng);
    }
  }, [measureMode, pointTapMode, drawingMode, isFreehandMode, handleAddNode, collectPointAtLatLng]);


  const undoDraftVertex = useCallback(() => {
    setDraftCoordinates(prev => prev.slice(0, -1));
  }, []);

  const clearDraftFeature = useCallback(() => {
    setDraftCoordinates([]);
    setDrawingMode(false);
    setIsFreehandMode(false);
  }, []);

  const finishDrawing = () => {
    const minVerts = drawingMode === 'Polygon' ? 3 : 2;
    if (draftCoordinates.length < minVerts) {
      alert(`Servono almeno ${minVerts} punti per completare ${drawingMode === 'Polygon' ? 'un Poligono' : 'una Linea'}.`);
      setDrawingMode(false);
      setDraftCoordinates([]);
      return;
    }
    const layer = layers.find(l => l.id === selectedLayerId);
    const layerCrs = getCrsCode(layer?.crs || 'EPSG:4326');
    const storedDraft = draftCoordinates.map(c => coordinatesToLayerCrs(c, layer));
    const newFeature = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        layerId: selectedLayerId,
        layerName: layer?.name || 'Sconosciuto',
        sourceCrs: layerCrs,
        timestamp: new Date().toISOString(),
        ...(buildDefaultProperties(layer))
      },
      geometry: {
        type: drawingMode === 'Polygon' ? 'Polygon' : 'LineString',
        coordinates: drawingMode === 'Polygon'
          ? [[...storedDraft, storedDraft[0]]]
          : storedDraft
      }
    };
    setCollectedPoints(prev => [...prev, newFeature]);
    setDrawingMode(false);
    setIsFreehandMode(false);
    setDraftCoordinates([]);
  };

  // Build default attribute values from layer schema

  const closePopup = ({ discardDraft = false } = {}) => {
    if ((discardDraft || isAddingRow) && popupFeature?.feature?.properties?.__draftRow) {
      const draftId = popupFeature.feature.properties.id;
      setCollectedPoints(prev => prev.filter(f => f.properties.id !== draftId));
    }
    setPopupFeature(null);
    setIsEditingPopup(false);
    setIsAddingRow(false);
    setShowAddFieldForm(false);
    setNewPopupField(EMPTY_NEW_FIELD);
  };

  const savePopup = () => {
    if (popupFeature?.feature?.properties?.__draftRow) {
      const draftId = popupFeature.feature.properties.id;
      setCollectedPoints(prev => prev.map(f => {
        if (f.properties.id !== draftId) return f;
        const { __draftRow, ...props } = f.properties;
        return { ...f, properties: props };
      }));
      setPopupFeature(prev => {
        if (!prev) return prev;
        const { __draftRow, ...props } = prev.feature.properties;
        return { ...prev, feature: { ...prev.feature, properties: props } };
      });
    }
    setIsEditingPopup(false);
    setIsAddingRow(false);
    setShowAddFieldForm(false);
    setNewPopupField(EMPTY_NEW_FIELD);
  };

  const deleteFeature = (featureId) => {
    if (confirm('Sei sicuro di voler eliminare questa geometria/riga?')) {
      setCollectedPoints(prev => prev.filter(f => f.properties.id !== featureId));
      closePopup({ discardDraft: false });
    }
  };


  const addFieldToFeature = (featureId) => {
    const fieldName = newPopupField.name.trim();
    const fieldType = newPopupField.type || 'String';
    if (!fieldName) {
      alert('Inserisci il nome del campo.');
      return;
    }
    if (popupFeature?.feature?.properties && Object.prototype.hasOwnProperty.call(popupFeature.feature.properties, fieldName)) {
      alert(`Il campo "${fieldName}" esiste già.`);
      return;
    }
    const defaultValue = getDefaultValueForType(fieldType);
    updateFeatureProperties(featureId, { [fieldName]: defaultValue });
    setLayers(prev => prev.map(layer => {
      if (layer.id !== popupFeature?.layer?.id) return layer;
      const fields = layer.fields || [];
      if (fields.some(f => f.name === fieldName)) return layer;
      return { ...layer, fields: [...fields, { name: fieldName, type: fieldType, defaultVal: '' }] };
    }));
    setPopupFeature(prev => prev ? {
      ...prev,
      layer: {
        ...prev.layer,
        fields: [
          ...(prev.layer.fields || []),
          ...(prev.layer.fields || []).some(f => f.name === fieldName) ? [] : [{ name: fieldName, type: fieldType, defaultVal: '' }]
        ]
      }
    } : prev);
    setNewPopupField(EMPTY_NEW_FIELD);
    setShowAddFieldForm(false);
    setIsEditingPopup(true);
  };




  const updateFeatureProperties = useCallback((featureId, patch) => {
    setCollectedPoints(prev => patchFeatureProperties(prev, featureId, patch));
    setPopupFeature(prev => {
      if (!prev?.feature || prev.feature.properties?.id !== featureId) return prev;
      return { ...prev, feature: { ...prev.feature, properties: { ...prev.feature.properties, ...patch } } };
    });
  }, [setCollectedPoints]);

  const createTableRow = (layer) => {
    const newFeature = createDraftTableFeature(layer);
    setCollectedPoints(prev => [...prev, newFeature]);
    setPopupFeature({ feature: newFeature, layer });
    setIsEditingPopup(true);
    setIsAddingRow(true);
  };

  const collectPoint = () => {
    if (activeTab === 'data-table') {
      if (layers.length === 0) {
        alert('Nessun layer presente. Crea prima un layer.');
        return;
      }
      const activeLayer = layers.find(l => l.id === selectedLayerId) || layers.find(l => getLayerGeometryKind(l) === 'Table') || layers[0];
      if (getLayerGeometryKind(activeLayer) === 'Table') {
        createTableRow(activeLayer);
      } else {
        setActiveTab('explore');
        alert('Seleziona un layer tabellare per aggiungere una riga senza geometria.');
      }
      return;
    }

    if (layers.length === 0) {
      alert('Nessun layer presente. Crea prima un layer dalla sezione Layer.');
      return;
    }
    const activeLayer = layers.find(l => l.id === selectedLayerId);
    if (!activeLayer) {
      alert('Nessun layer selezionato. Apri la TOC e seleziona un layer.');
      setActiveTab('explore');
      setIsTocSidebarOpen(true);
      return;
    }
    const geomKind = getLayerGeometryKind(activeLayer);

    if (geomKind === 'Table') {
      createTableRow(activeLayer);
      return;
    }

    if (geomKind === 'Point') {
      let position = gpsState.position;
      let accuracy = gpsState.accuracy;

      if (!position) {
        // Fallback to map center if GPS is not active
        if (map) {
          const center = map.getCenter();
          position = [center.lng, center.lat];
          accuracy = null;
          if (window.__GIS_DEBUG__) console.debug("GPS non attivo, uso il centro mappa.");
        } else {
          alert('Impossibile determinare la posizione (GPS non attivo e mappa non pronta).');
          return;
        }
      }

      createPointFeatureAtPosition(position, accuracy);
    } else {
      // Line or Polygon — start drawing mode
      const mode = geomKind === 'Line' ? 'Line' : 'Polygon';
      setDrawingMode(mode);
      setDraftCoordinates([]);
      setActiveTab('explore');
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportData = async (options = {}) => exportFeatures(options, {
    collectedPoints,
    layers,
    projectCrs,
    getFeatureSourceCrs,
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const gpsIcon = createGpsIcon(deviceHeading || 0);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0f172a] font-sans select-none text-slate-100 flex flex-col">

      {/* PERSISTENT MAP BACKGROUND */}
      <div className={`absolute inset-0 transition-all duration-700 z-0 ${activeTab !== 'explore' ? 'blur-md scale-105 opacity-40 pointer-events-none' : 'opacity-100'}`}>
        <MapContainer
          center={[41.9028, 12.4964]}
          zoom={13}
          zoomControl={false}
          rotate={true}
          rotateControl={false}
          touchRotate={true}
          style={{ width: '100%', height: '100%', background: '#0f172a' }}
        >
          <TileLayer
            attribution={BASEMAPS[activeBasemap].attr}
            url={BASEMAPS[activeBasemap].url}
          />

          <MapController
            setMap={setMap}
            gpsPosition={gpsState.position}
            mapRotation={settings.compassMode ? deviceHeading : mapBearing}
            setMapBearing={setMapBearing}
            setGridScaleMeters={setGridScaleMeters}
            isFreehandMode={isFreehandMode && !!drawingMode}
            onAddNode={handleAddNode}
            scaleLocked={scaleLocked}
          />
          <MapEvents onMapClick={handleMapClick} suppressMultiTouchClick={pointTapMode} />

          {gpsState.position && (
            <Marker position={[gpsState.position[1], gpsState.position[0]]} icon={gpsIcon} />
          )}
          {goToMarker && (
            <Marker position={[goToMarker[1], goToMarker[0]]} icon={goToIcon} />
          )}

          {collectedPoints.map(feature => {
            const layer = layers.find(l => l.id === feature.properties.layerId);
            if (!layer || !layer.active || !feature.geometry) return null;
            const color = resolveFeatureColor(feature, layer);
            const displayGeometry = geometryToWgs84(feature, layer);
            if (!displayGeometry) return null;
            const eventHandlers = {
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (measureMode) {
                  handleMapClick(e);
                  return;
                }
                setPopupFeature({ feature, layer });
              }
            };

            if (displayGeometry.type === 'Point') {
              return (
                <CircleMarker
                  key={feature.properties.id}
                  center={[displayGeometry.coordinates[1], displayGeometry.coordinates[0]]}
                  radius={7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
                  eventHandlers={eventHandlers}
                />
              );
            }
            if (displayGeometry.type === 'LineString') {
              return (
                <Polyline
                  key={feature.properties.id}
                  positions={displayGeometry.coordinates.map(c => [c[1], c[0]])}
                  pathOptions={{ color, weight: 4 }}
                  eventHandlers={eventHandlers}
                />
              );
            }
            if (displayGeometry.type === 'Polygon') {
              return (
                <Polygon
                  key={feature.properties.id}
                  positions={displayGeometry.coordinates[0].map(c => [c[1], c[0]])}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
                  eventHandlers={eventHandlers}
                />
              );
            }
            return null;
          })}

          {/* Draft geometry preview */}
          {drawingMode && draftCoordinates.length > 0 && (
            drawingMode === 'Line'
              ? <Polyline positions={draftCoordinates.map(c => [c[1], c[0]])} pathOptions={{ color: '#fff', dashArray: '6, 10', weight: 3 }} />
              : <Polygon positions={draftCoordinates.map(c => [c[1], c[0]])} pathOptions={{ color: '#00bfff', fillColor: '#00bfff', fillOpacity: 0.15, dashArray: '6, 10', weight: 3 }} />
          )}

          {/* Measurement preview */}
          {measureMode && measureCoordinates.length > 0 && (
            measureMode === 'Area' && measureCoordinates.length >= 3
              ? <Polygon positions={measureCoordinates.map(c => [c[1], c[0]])} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.18, dashArray: '4, 8', weight: 3 }} />
              : <Polyline positions={measureCoordinates.map(c => [c[1], c[0]])} pathOptions={{ color: '#f59e0b', dashArray: '4, 8', weight: 3 }} />
          )}
        </MapContainer>
      </div>

      {/* SCREEN ROUTER */}
      <div className="relative h-full w-full z-10 p-0 sm:p-6 pb-24 pointer-events-none">

        {/* Global Center Crosshair (Fixed for accuracy) */}
        {activeTab === 'explore' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 ${activeBasemap === 'osm' ? 'border-black/60 shadow-[0_0_15px_rgba(0,0,0,0.3)]' : 'border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.3)]'} flex items-center justify-center`}>
              <div className={`w-1.5 h-1.5 ${activeBasemap === 'osm' ? 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.8)]' : 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]'} rounded-full`} />
            </div>
          </div>
        )}

        {activeTab === 'explore' && (
          <ExploreHUD
            language={language}
            showGrid={showGrid} setShowGrid={setShowGrid}
            activeBasemap={activeBasemap} setActiveBasemap={setActiveBasemap}
            gpsState={gpsState} locateMe={locateMe}
            drawingMode={drawingMode} finishDrawing={finishDrawing}
            draftCoordinatesCount={draftCoordinates.length}
            undoDraftVertex={undoDraftVertex}
            clearDraftFeature={clearDraftFeature}
            mapBearing={mapBearing} setMapBearing={setMapBearing}
            gridScaleMeters={gridScaleMeters}
            onAddFeature={collectPoint}
            layers={layers}
            selectedLayerId={selectedLayerId}
            units={settings.units}
            map={map}
            isFreehandMode={isFreehandMode}
            setIsFreehandMode={setIsFreehandMode}
            pointTapMode={pointTapMode}
            setPointTapMode={setPointTapMode}
            measureMode={measureMode}
            measureCoordinates={measureCoordinates}
            measureResult={formatMeasureValue(measureMode, measureCoordinates)}
            toggleMeasureMode={toggleMeasureMode}
            clearMeasure={clearMeasure}
            gpsCoordinateLabel={gpsState.position ? formatCoordinate(transformCoord(gpsState.position, 'EPSG:4326', projectCrs), projectCrs) : ''}
            projectCrs={projectCrs}
            projectCrsInfo={projectCrsInfo}
            onProjectCrsChange={(crs) => setSettings(prev => ({ ...prev, projectCrs: crs, crsOverride: true }))}
            onSelectedLayerChange={setSelectedLayerId}
            onGoToCoordinate={goToCoordinate}
            setActiveTab={setActiveTab}
            scaleLocked={scaleLocked}
            lockedScaleDenominator={lockedScaleDenominator}
            toggleScaleLock={toggleScaleLock}
            setManualScale={setManualScale}
          />
        )}



        {activeTab === 'add-feature' && <AddDataMenu setActiveTab={setActiveTab} language={language} />}

        {activeTab === 'new-layer' && (
          <NewLayerView
            language={language}
            newLayer={newLayer} setNewLayer={setNewLayer}
            setActiveTab={setActiveTab} layers={layers} setLayers={setLayers}
            setSelectedLayerId={setSelectedLayerId}
            projectCrs={projectCrs}
          />
        )}

        {activeTab === 'upload' && (
          <UploadView
            language={language}
            layers={layers} setLayers={setLayers}
            setCollectedPoints={setCollectedPoints}
            setSelectedLayerId={setSelectedLayerId}
            setActiveTab={setActiveTab}
            projectCrs={projectCrs}
          />
        )}

        {activeTab === 'data-table' && (
          <DataTableView
            language={language}
            collectedPoints={collectedPoints} setCollectedPoints={setCollectedPoints}
            layers={layers} exportData={exportData}
            projectCrs={projectCrs}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            language={language}
            draftSettings={draftSettings} setDraftSettings={setDraftSettings}
            saveSettings={saveSettings}
            showTutorialAgain={showTutorialAgain}
          />
        )}

        {/* FEATURE ATTRIBUTE POPUP */}
        {popupFeature && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => closePopup({ discardDraft: true })}>
            <div className="glass w-full max-w-sm rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">{t(language, 'featureProperties')}</h3>
                  <p className="text-[10px] text-primary font-bold mt-0.5 uppercase">{popupFeature.layer.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingPopup && (
                    <>
                      <button
                        onClick={() => setShowAddFieldForm(v => !v)}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-emerald-400 transition-all"
                        title="Aggiungi campo"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                      </button>
                      <button
                        onClick={() => deleteFeature(popupFeature.feature.properties.id)}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-red-400 transition-all"
                        title="Elimina geometria"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                      <button
                        onClick={() => setIsEditingPopup(true)}
                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-primary transition-all"
                        title="Modifica attributi"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                    </>
                  )}
                  <button onClick={() => closePopup({ discardDraft: true })} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                {showAddFieldForm && (
                  <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="text-[9px] font-bold text-white/50 uppercase tracking-widest">{t(language, 'fieldName')}</div>
                    <input
                      type="text"
                      value={newPopupField.name}
                      onChange={(e) => setNewPopupField(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t(language, 'fieldName')}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
                    />
                    <select
                      value={newPopupField.type}
                      onChange={(e) => setNewPopupField(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
                    >
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowAddFieldForm(false); setNewPopupField(EMPTY_NEW_FIELD); }} className="px-3 py-2 rounded-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-white/50">{t(language, 'cancel')}</button>
                      <button onClick={() => addFieldToFeature(popupFeature.feature.properties.id)} className="px-3 py-2 rounded-lg bg-primary/20 text-[9px] font-bold uppercase tracking-widest text-primary">{t(language, 'add')}</button>
                    </div>
                  </div>
                )}
                <table className="w-full text-left border-collapse">
                  <tbody className="divide-y divide-white/5">
                    {Object.entries(popupFeature.feature.properties).filter(([key]) => key !== '__draftRow').map(([key, val]) => {
                      const isReadOnly = ['id', 'layerId', 'layerName', 'timestamp', 'accuracy', '__draftRow'].includes(key);
                      return (
                        <tr key={key} className="group">
                          <td className="py-2.5 pr-4 align-top">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mt-1">{key}</span>
                          </td>
                          <td className="py-2.5">
                            {isEditingPopup && !isReadOnly ? (
                              (() => {
                                const fieldType = getFieldType(popupFeature.feature, popupFeature.layer, key);
                                if (fieldType === 'Boolean') {
                                  return (
                                    <select
                                      value={String(Boolean(val))}
                                      onChange={(e) => updateFeatureProperties(popupFeature.feature.properties.id, { [key]: e.target.value === 'true' })}
                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary transition-all"
                                    >
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  );
                                }
                                return (
                                  <input
                                    type={fieldType === 'Integer' || fieldType === 'Double' ? 'number' : fieldType === 'Date' ? 'date' : 'text'}
                                    value={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                                    onChange={(e) => updateFeatureProperties(popupFeature.feature.properties.id, { [key]: coerceFieldValue(fieldType, e.target.value) })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary transition-all"
                                  />
                                );
                              })()
                            ) : (
                              <span className={`text-xs break-all ${isReadOnly ? 'text-white/40 italic' : 'text-white/90'}`}>
                                {typeof val === 'object' ? JSON.stringify(val) : String(val || '—')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                {isEditingPopup ? (
                  <button
                    onClick={savePopup}
                    className="px-8 py-3 bg-primary text-white font-bold uppercase tracking-widest rounded-xl hover:scale-105 transition-transform shadow-xl shadow-primary/20 text-xs"
                  >
                    Salva e Chiudi
                  </button>
                ) : (
                  <button onClick={() => closePopup({ discardDraft: true })} className="px-6 py-2 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-primary/30 transition-all">
                    Chiudi
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent TOC sidebar: independent from bottom navigation */}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTocSidebar(); }}
        className={`fixed left-3 sm:left-5 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 z-[1000] pointer-events-auto glass w-12 h-12 rounded-2xl border border-white/20 shadow-2xl flex items-center justify-center transition-all ${isTocSidebarOpen ? 'text-white bg-primary/30 border-primary/50' : 'text-primary hover:bg-primary/10'}`}
        aria-label={isTocSidebarOpen ? 'Chiudi indice layer' : 'Apri indice layer'}
          title={isTocSidebarOpen ? 'Chiudi indice layer' : 'Apri indice layer'}
      >
        {tocLayerIcon}
      </button>

      {isTocSidebarOpen && activeTab === 'explore' && (
        <div className="fixed left-0 top-0 bottom-0 z-[990] pointer-events-auto w-[min(92vw,420px)] p-3 sm:p-4 pr-2 animate-in slide-in-from-left-4 fade-in duration-300">
          <div className="relative h-full w-full">
            <LayersView
              language={language}
              layers={layers} layerFilter={layerFilter} setLayerFilter={setLayerFilter}
              selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId}
              toggleLayer={toggleLayer} deleteLayer={deleteLayer} setActiveTab={setActiveTab} setLayers={setLayers}
            />
          </div>
        </div>
      )}

      {showOnboarding && <OnboardingGuide language={language} onFinish={finishOnboarding} />}

      {/* BOTTOM NAVIGATION */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onAddFeature={collectPoint} language={language} />
    </div>
  );
}
