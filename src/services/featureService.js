import { getCrsCode } from './crsService';

export function buildDefaultProperties(layer) {
  if (!layer?.fields) return {};
  const props = {};
  layer.fields.forEach(f => {
    if (f.name === 'ID') return;
    if (f.defaultVal === 'NOW') props[f.name] = new Date().toISOString();
    else if (f.defaultVal && f.defaultVal !== 'AUTO_INC') props[f.name] = f.defaultVal;
    else props[f.name] = '';
  });
  return props;
}

export function getDefaultValueForType(type) {
  if (type === 'Integer') return 0;
  if (type === 'Double') return 0;
  if (type === 'Boolean') return false;
  if (type === 'Date') return new Date().toISOString().split('T')[0];
  return '';
}

export function getFieldType(feature, layer, key) {
  const field = layer?.fields?.find(f => f.name === key);
  if (field?.type) return field.type;
  const val = feature?.properties?.[key];
  if (typeof val === 'number') return Number.isInteger(val) ? 'Integer' : 'Double';
  if (typeof val === 'boolean') return 'Boolean';
  return 'String';
}

export function coerceFieldValue(type, rawValue) {
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
}

export function createDraftTableFeature(layer) {
  const featureId = Date.now();
  return {
    type: 'Feature',
    geometry: null,
    properties: {
      id: featureId,
      ID: featureId,
      layerId: layer.id,
      layerName: layer.name,
      sourceCrs: getCrsCode(layer.crs || 'EPSG:4326'),
      timestamp: new Date().toISOString(),
      __draftRow: true,
      ...buildDefaultProperties(layer),
    },
  };
}
