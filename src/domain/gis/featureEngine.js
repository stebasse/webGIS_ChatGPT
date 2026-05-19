export { buildDefaultProperties, coerceFieldValue, createDraftTableFeature, getDefaultValueForType, getFieldType } from '../../services/featureService';

export function updateFeatureProperties(features, featureId, patch) {
  return features.map(feature => feature.properties?.id === featureId
    ? { ...feature, properties: { ...feature.properties, ...patch } }
    : feature
  );
}
