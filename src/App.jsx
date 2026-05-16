import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Polygon, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotate';

import { LAYERS, BASEMAPS } from './config/constants';
import { usePersistentState } from './hooks/usePersistentState';
import { useDeviceCompass } from './hooks/useDeviceCompass';

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
import { formatProjectedCoordinate, measureProjectedDistance, measureProjectedArea, getCrsDefinition, transformGeometryToProjectCrs } from './utils/crs';
import OnboardingGuide from './components/OnboardingGuide';

// Resolve a feature's display color given its layer and symbology rules
function resolveFeatureColor(feature, layer) {
  if (!layer) return '#0ea5e9';
  const base = layer.colorHex || '#0ea5e9';
  const sym = layer.symbology;
  if (!sym || sym.mode !== 'categorized' || !sym.attribute || !sym.rules?.length) return base;
  const attrVal = String(feature.properties?.[sym.attribute] ?? '');
  const match = sym.rules.find(r => String(r.value) === attrVal);
  return match ? match.color : base;
}

const DEFAULT_SETTINGS = {
  theme: 'dark', units: 'metric', crsOverride: false,
  crsCode: 'EPSG:4326',
  crsName: 'WGS 84',
  crsProj4: '+proj=longlat +datum=WGS84 +no_defs',
  gpu: true, logLevel: 'low', compassMode: false
};

const FIELD_TYPES = ['String', 'Integer', 'Double', 'Date', 'Boolean'];

export default function App() {
  const [activeTab, setActiveTab] = useState('explore');
  const [isTocSidebarOpen, setIsTocSidebarOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [activeBasemap, setActiveBasemap] = useState('carto_dark');

  // Persistent state
  const [layers, setLayers] = usePersistentState('stitch_gis_layers', LAYERS);
  const [collectedPoints, setCollectedPoints] = usePersistentState('stitch_gis_points', []);
  const [settings, setSettings] = usePersistentState('stitch_gis_settings', DEFAULT_SETTINGS);
  const [selectedLayerId, setSelectedLayerId] = usePersistentState('stitch_gis_selected_layer', null);

  // Validate selectedLayerId points to a real layer
  useEffect(() => {
    if (selectedLayerId !== null && !layers.find(l => l.id === selectedLayerId)) {
      setSelectedLayerId(layers.length > 0 ? layers[0].id : null);
    }
  }, [layers, selectedLayerId, setSelectedLayerId]);

  // Apply theme class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', settings.theme === 'light');
  }, [settings.theme]);

  // Log verbosity
  useEffect(() => {
    window.__GIS_DEBUG__ = settings.logLevel === 'high';
  }, [settings.logLevel]);

  const [draftSettings, setDraftSettings] = useState(settings);
  const [gpsState, setGpsState] = useState({ position: null, accuracy: null, tracking: false });
  const [mapBearing, setMapBearing] = useState(0);
  const [gridScaleMeters, setGridScaleMeters] = useState(100);
  const [drawingMode, setDrawingMode] = useState(false);  // false | 'Line' | 'Polygon'
  const [draftCoordinates, setDraftCoordinates] = useState([]);
  const [layerFilter, setLayerFilter] = useState('');
  const [newLayer, setNewLayer] = useState({ name: '', type: 'Point' });
  const [uploadSearch, setUploadSearch] = useState('');
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [popupFeature, setPopupFeature] = useState(null);
  const [isEditingPopup, setIsEditingPopup] = useState(false);
  const [isFreehandMode, setIsFreehandMode] = useState(false);
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);
  const [newPopupField, setNewPopupField] = useState({ name: '', type: 'String' });
  const [measureMode, setMeasureMode] = useState(false); // false | 'Distance' | 'Area'
  const [measureCoordinates, setMeasureCoordinates] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem('webgis_onboarding_completed') !== 'true';
    } catch {
      return true;
    }
  });


  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem('webgis_onboarding_completed', 'true');
    } catch {
      // localStorage may be unavailable in private mode; still close the guide for this session.
    }
    setShowOnboarding(false);
  }, []);

  const showTutorialAgain = useCallback(() => {
    try {
      localStorage.removeItem('webgis_onboarding_completed');
    } catch {
      // Ignore storage errors and reopen in the current session.
    }
    setShowOnboarding(true);
    setActiveTab('explore');
  }, []);

  const deviceHeading = useDeviceCompass();

  const toggleLayer = (id) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const deleteLayer = (id) => {
    if (!window.confirm('Eliminare definitivamente questo layer e TUTTE le feature associate?')) return;
    setLayers(prev => prev.filter(l => l.id !== id));
    setCollectedPoints(prev => prev.filter(f => f.properties.layerId !== id));
  };

  // ── GPS ──────────────────────────────────────────────────────────────────
  const gpsWatchRef = useRef(null);
  const [map, setMap] = useState(null);

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation non è supportata da questo browser.');
      return;
    }

    if (gpsState.tracking && gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      setGpsState(prev => ({ ...prev, tracking: false }));
      return;
    }

    // Check for Secure Context (HTTPS or Localhost) before starting
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isSecure = window.isSecureContext;

    if (!isSecure && !isLocal) {
      alert(
        "GPS BLOCCATO (CONTESTO NON SICURO)\n\n" +
        "Il browser impedisce l'uso del GPS su connessioni HTTP non criptate (come l'accesso via IP locale: " + window.location.hostname + ").\n\n" +
        "Per attivare il GPS su questo dispositivo:\n" +
        "1. Usa un tunnel HTTPS (es. ngrok o certificati locali).\n" +
        "2. Accedi all'app tramite 'localhost' (se sei sul PC che esegue il server).\n" +
        "3. (Solo Chrome/Edge) Abilita l'indirizzo nelle impostazioni avanzate: chrome://flags/#unsafely-treat-insecure-origin-as-secure aggiungendo questo URL."
      );
      return;
    }

    setGpsState(prev => ({ ...prev, tracking: true }));
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState({
          position: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
          tracking: true
        });
      },
      (error) => {
        const msgs = {
          1: 'Permesso negato. Abilita la localizzazione nelle impostazioni del browser per questo sito.',
          2: 'Posizione non disponibile. Assicurati di avere il GPS attivo sul dispositivo.',
          3: 'Timeout. Il GPS non ha risposto in tempo. Riprova.'
        };
        alert('Errore GPS: ' + (msgs[error.code] || error.message));
        setGpsState(prev => ({ ...prev, tracking: false }));
        gpsWatchRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ── Compass permission (iOS Safari) ──────────────────────────────────────
  const requestCompassPermission = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        return res === 'granted';
      } catch { return false; }
    }
    return true; // not iOS, no permission needed
  };

  // ── Measurement helpers ────────────────────────────────────────────────
  const toRad = (deg) => deg * Math.PI / 180;

  const segmentDistanceMeters = (a, b) => {
    const R = 6371008.8;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const measureDistanceMeters = (coords) => {
    const projected = measureProjectedDistance(coords, settings);
    if (projected !== null) return projected;
    return coords.slice(1).reduce((sum, c, i) => sum + segmentDistanceMeters(coords[i], c), 0);
  };

  const measureAreaSqMeters = (coords) => {
    if (coords.length < 3) return 0;
    const projectedArea = measureProjectedArea(coords, settings);
    if (projectedArea !== null) return projectedArea;
    const R = 6371008.8;
    const lat0 = toRad(coords.reduce((sum, c) => sum + c[1], 0) / coords.length);
    const projected = coords.map(([lng, lat]) => [R * toRad(lng) * Math.cos(lat0), R * toRad(lat)]);
    let area = 0;
    for (let i = 0; i < projected.length; i++) {
      const [x1, y1] = projected[i];
      const [x2, y2] = projected[(i + 1) % projected.length];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
  };

  const formatMeasureValue = (mode, coords) => {
    if (!mode || coords.length === 0) return '';
    if (mode === 'Distance') {
      const m = measureDistanceMeters(coords);
      if (settings.units === 'imperial') {
        const ft = m * 3.28084;
        return ft >= 5280 ? `${(ft / 5280).toFixed(2)} mi` : `${ft.toFixed(1)} ft`;
      }
      return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(2)} m`;
    }
    const sqm = measureAreaSqMeters(coords);
    if (settings.units === 'imperial') {
      const sqft = sqm * 10.7639;
      return sqft >= 43560 ? `${(sqft / 43560).toFixed(3)} ac` : `${sqft.toFixed(1)} ft²`;
    }
    return sqm >= 10000 ? `${(sqm / 10000).toFixed(4)} ha` : `${sqm.toFixed(2)} m²`;
  };

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
    if (drawingMode && !isFreehandMode) {
      handleAddNode(latlng);
    }
  }, [measureMode, drawingMode, isFreehandMode, handleAddNode]);

  const finishDrawing = () => {
    const minVerts = drawingMode === 'Polygon' ? 3 : 2;
    if (draftCoordinates.length < minVerts) {
      alert(`Servono almeno ${minVerts} punti per completare ${drawingMode === 'Polygon' ? 'un Poligono' : 'una Linea'}.`);
      setDrawingMode(false);
      setDraftCoordinates([]);
      return;
    }
    const layer = layers.find(l => l.id === selectedLayerId);
    const newFeature = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        layerId: selectedLayerId,
        layerName: layer?.name || 'Unknown',
        timestamp: new Date().toISOString(),
        ...(buildDefaultProperties(layer))
      },
      geometry: {
        type: drawingMode === 'Polygon' ? 'Polygon' : 'LineString',
        coordinates: drawingMode === 'Polygon'
          ? [[...draftCoordinates, draftCoordinates[0]]]
          : draftCoordinates
      }
    };
    setCollectedPoints(prev => [...prev, newFeature]);
    setDrawingMode(false);
    setIsFreehandMode(false);
    setDraftCoordinates([]);
  };

  // Build default attribute values from layer schema
  function buildDefaultProperties(layer) {
    if (!layer?.fields) return {};
    const props = {};
    layer.fields.forEach(f => {
      if (f.name === 'ID') return; // handled by feature id
      if (f.defaultVal === 'NOW') props[f.name] = new Date().toISOString();
      else if (f.defaultVal && f.defaultVal !== 'AUTO_INC') props[f.name] = f.defaultVal;
      else props[f.name] = '';
    });
    return props;
  }

  const updateFeatureProperties = (featureId, newProps) => {
    setCollectedPoints(prev => prev.map(f =>
      f.properties.id === featureId ? { ...f, properties: { ...f.properties, ...newProps } } : f
    ));
    if (popupFeature && popupFeature.feature.properties.id === featureId) {
      setPopupFeature(prev => ({
        ...prev,
        feature: { ...prev.feature, properties: { ...prev.feature.properties, ...newProps } }
      }));
    }
  };

  const closePopup = ({ discardDraft = false } = {}) => {
    if ((discardDraft || isAddingRow) && popupFeature?.feature?.properties?.__draftRow) {
      const draftId = popupFeature.feature.properties.id;
      setCollectedPoints(prev => prev.filter(f => f.properties.id !== draftId));
    }
    setPopupFeature(null);
    setIsEditingPopup(false);
    setIsAddingRow(false);
    setShowAddFieldForm(false);
    setNewPopupField({ name: '', type: 'String' });
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
    setNewPopupField({ name: '', type: 'String' });
  };

  const deleteFeature = (featureId) => {
    if (confirm('Sei sicuro di voler eliminare questa geometria/riga?')) {
      setCollectedPoints(prev => prev.filter(f => f.properties.id !== featureId));
      closePopup({ discardDraft: false });
    }
  };

  const getDefaultValueForType = (type) => {
    if (type === 'Integer') return 0;
    if (type === 'Double') return 0;
    if (type === 'Boolean') return false;
    if (type === 'Date') return new Date().toISOString().split('T')[0];
    return '';
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
    setNewPopupField({ name: '', type: 'String' });
    setShowAddFieldForm(false);
    setIsEditingPopup(true);
  };

  const getFieldType = (feature, layer, key) => {
    const field = layer?.fields?.find(f => f.name === key);
    if (field?.type) return field.type;
    const val = feature?.properties?.[key];
    if (typeof val === 'number') return Number.isInteger(val) ? 'Integer' : 'Double';
    if (typeof val === 'boolean') return 'Boolean';
    return 'String';
  };

  const coerceFieldValue = (type, rawValue) => {
    if (type === 'Integer') {
      const n = parseInt(rawValue, 10);
      return Number.isFinite(n) ? n : 0;
    }
    if (type === 'Double') {
      const n = Number(rawValue);
      return Number.isFinite(n) ? n : 0;
    }
    if (type === 'Boolean') return Boolean(rawValue);
    return rawValue;
  };

  const createTableRow = (layer) => {
    const featureId = Date.now();
    const props = {
      id: featureId,
      ID: featureId,
      layerId: layer.id,
      layerName: layer.name,
      timestamp: new Date().toISOString(),
      __draftRow: true,
      ...buildDefaultProperties(layer)
    };
    const newFeature = {
      type: 'Feature',
      geometry: null,
      properties: props
    };
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
      const activeLayer = layers.find(l => l.id === selectedLayerId) || layers.find(l => l.type?.includes('Table')) || layers[0];
      if (activeLayer.type?.includes('Table')) {
        createTableRow(activeLayer);
      } else {
        setActiveTab('explore');
        alert('Seleziona un layer tabellare per aggiungere una riga senza geometria.');
      }
      return;
    }

    if (layers.length === 0) {
      alert('Nessun layer presente. Crea prima un layer dalla sezione Layers.');
      return;
    }
    const activeLayer = layers.find(l => l.id === selectedLayerId);
    if (!activeLayer) {
      alert('Nessun layer selezionato. Apri la TOC e seleziona un layer.');
      setIsTocSidebarOpen(true);
      setActiveTab('explore');
      return;
    }
    const geomType = activeLayer.type; // e.g. "Vector - Point", "Vector - Table"

    if (geomType.includes('Table')) {
      createTableRow(activeLayer);
      return;
    }

    if (geomType.includes('Point')) {
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

      const newPoint = {
        type: 'Feature',
        properties: {
          id: Date.now(),
          layerId: selectedLayerId,
          layerName: activeLayer.name,
          timestamp: new Date().toISOString(),
          accuracy: accuracy,
          ...buildDefaultProperties(activeLayer)
        },
        geometry: { type: 'Point', coordinates: position }
      };
      setCollectedPoints(prev => [...prev, newPoint]);
      // Brief visual feedback without blocking alert
      const total = collectedPoints.length + 1;
      if (window.__GIS_DEBUG__) console.debug(`Point collected. Total: ${total}`);
    } else {
      // Line or Polygon — start drawing mode
      const mode = geomType.includes('Line') ? 'Line' : 'Polygon';
      setDrawingMode(mode);
      setDraftCoordinates([]);
      setActiveTab('explore');
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportData = (layerIdFilter = null) => {
    const features = layerIdFilter
      ? collectedPoints.filter(f => f.properties.layerId === layerIdFilter)
      : collectedPoints;
    if (features.length === 0) {
      alert('Nessuna feature da esportare.');
      return;
    }
    const crsDef = getCrsDefinition(settings);
    const exportFeatures = crsDef.transformable && crsDef.code !== 'EPSG:4326'
      ? features.map(f => ({
          ...f,
          properties: { ...f.properties, projectCrs: crsDef.code, originalCrs: f.properties?.crs || 'EPSG:4326' },
          geometry: transformGeometryToProjectCrs(f.geometry, settings)
        }))
      : features;
    const geojson = {
      type: 'FeatureCollection',
      name: layerIdFilter ? (layers.find(l => l.id === layerIdFilter)?.name || 'layer') : 'all_layers',
      crs: { type: 'name', properties: { name: crsDef.code, note: crsDef.transformable ? 'Coordinates exported in selected project CRS.' : 'CRS metadata only; coordinates remain WGS84 lon/lat.' } },
      features: exportFeatures
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const layerName = layerIdFilter
      ? (layers.find(l => l.id === layerIdFilter)?.name || 'layer')
      : 'all_layers';
    a.download = `${layerName}_${(settings.crsCode || 'EPSG4326').replace(':','')}_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    // If compassMode just turned on, request permission on iOS
    if (draftSettings.compassMode && !settings.compassMode) {
      const granted = await requestCompassPermission();
      if (!granted) {
        alert('Permesso orientamento dispositivo negato. Compass Mode disabilitata.');
        setDraftSettings(s => ({ ...s, compassMode: false }));
        return;
      }
    }
    setSettings(draftSettings);
    setActiveTab('explore');
  };

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
          />
          <MapEvents onMapClick={handleMapClick} />

          {gpsState.position && (
            <Marker position={[gpsState.position[1], gpsState.position[0]]} icon={gpsIcon} />
          )}

          {collectedPoints.map(feature => {
            const layer = layers.find(l => l.id === feature.properties.layerId);
            if (!layer || !layer.active || !feature.geometry) return null;
            const color = resolveFeatureColor(feature, layer);
            const eventHandlers = {
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                setPopupFeature({ feature, layer });
              }
            };

            if (feature.geometry.type === 'Point') {
              return (
                <CircleMarker
                  key={feature.properties.id}
                  center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
                  radius={7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
                  eventHandlers={eventHandlers}
                />
              );
            }
            if (feature.geometry.type === 'LineString') {
              return (
                <Polyline
                  key={feature.properties.id}
                  positions={feature.geometry.coordinates.map(c => [c[1], c[0]])}
                  pathOptions={{ color, weight: 4 }}
                  eventHandlers={eventHandlers}
                />
              );
            }
            if (feature.geometry.type === 'Polygon') {
              return (
                <Polygon
                  key={feature.properties.id}
                  positions={feature.geometry.coordinates[0].map(c => [c[1], c[0]])}
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
            showGrid={showGrid} setShowGrid={setShowGrid}
            activeBasemap={activeBasemap} setActiveBasemap={setActiveBasemap}
            gpsState={gpsState} locateMe={locateMe}
            drawingMode={drawingMode} finishDrawing={finishDrawing}
            mapBearing={mapBearing} setMapBearing={setMapBearing}
            gridScaleMeters={gridScaleMeters}
            onAddFeature={collectPoint}
            layers={layers}
            selectedLayerId={selectedLayerId}
            units={settings.units}
            map={map}
            isFreehandMode={isFreehandMode}
            setIsFreehandMode={setIsFreehandMode}
            measureMode={measureMode}
            measureCoordinates={measureCoordinates}
            measureResult={formatMeasureValue(measureMode, measureCoordinates)}
            toggleMeasureMode={toggleMeasureMode}
            clearMeasure={clearMeasure}
            projectCoordinateText={gpsState.position ? formatProjectedCoordinate(gpsState.position, settings) : ''}
            projectCrsStatus={getCrsDefinition(settings)}
          />
        )}

        {activeTab === 'add-feature' && <AddDataMenu setActiveTab={setActiveTab} />}

        {activeTab === 'new-layer' && (
          <NewLayerView
            newLayer={newLayer} setNewLayer={setNewLayer}
            setActiveTab={setActiveTab} layers={layers} setLayers={setLayers}
            setSelectedLayerId={setSelectedLayerId}
            settings={settings}
          />
        )}

        {activeTab === 'upload' && (
          <UploadView
            layers={layers} setLayers={setLayers}
            setCollectedPoints={setCollectedPoints}
            setSelectedLayerId={setSelectedLayerId}
            setActiveTab={setActiveTab}
            settings={settings}
          />
        )}

        {activeTab === 'data-table' && (
          <DataTableView
            collectedPoints={collectedPoints} setCollectedPoints={setCollectedPoints}
            layers={layers} exportData={exportData}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            draftSettings={draftSettings} setDraftSettings={setDraftSettings}
            saveSettings={saveSettings}
            showTutorialAgain={showTutorialAgain}
          />
        )}


        {/* TOC SIDEBAR - always available from the bottom-left corner */}
        <button
          onClick={() => setIsTocSidebarOpen(prev => !prev)}
          className={`fixed left-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 z-[95] pointer-events-auto glass w-12 h-12 rounded-2xl border shadow-2xl flex items-center justify-center transition-all duration-300 ${isTocSidebarOpen ? 'border-primary/50 text-white bg-primary/20' : 'border-white/20 text-primary hover:bg-primary/10'}`}
          title={isTocSidebarOpen ? 'Close TOC / Layers' : 'Open TOC / Layers'}
          aria-label={isTocSidebarOpen ? 'Close TOC / Layers' : 'Open TOC / Layers'}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 3L3 7.5L12 12L21 7.5L12 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 12L12 16.5L21 12" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M3 16.5L12 21L21 16.5" />
          </svg>
        </button>

        <aside
          className={`fixed left-0 top-0 bottom-0 z-[90] pointer-events-auto w-[min(92vw,420px)] p-3 sm:p-4 transition-transform duration-300 ease-out ${isTocSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-hidden={!isTocSidebarOpen}
        >
          <div className="relative h-full w-full animate-in slide-in-from-left-4 fade-in duration-300">
            <LayersView
              layers={layers} layerFilter={layerFilter} setLayerFilter={setLayerFilter}
              selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId}
              toggleLayer={toggleLayer} deleteLayer={deleteLayer} setActiveTab={setActiveTab} setLayers={setLayers}
            />
          </div>
        </aside>

        {/* FEATURE ATTRIBUTE POPUP */}
        {popupFeature && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={() => closePopup({ discardDraft: true })}>
            <div className="glass w-full max-w-sm rounded-[2rem] border border-white/20 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest">Dettagli Feature</h3>
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
                    <div className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Nuovo campo</div>
                    <input
                      type="text"
                      value={newPopupField.name}
                      onChange={(e) => setNewPopupField(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome campo"
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
                      <button onClick={() => { setShowAddFieldForm(false); setNewPopupField({ name: '', type: 'String' }); }} className="px-3 py-2 rounded-lg bg-white/5 text-[9px] font-bold uppercase tracking-widest text-white/50">Annulla</button>
                      <button onClick={() => addFieldToFeature(popupFeature.feature.properties.id)} className="px-3 py-2 rounded-lg bg-primary/20 text-[9px] font-bold uppercase tracking-widest text-primary">Aggiungi</button>
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

      {showOnboarding && <OnboardingGuide onFinish={finishOnboarding} />}

      {/* BOTTOM NAVIGATION */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onAddFeature={collectPoint} />
    </div>
  );
}
