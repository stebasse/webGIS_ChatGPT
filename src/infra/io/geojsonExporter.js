export function toFeatureCollection(features = []) {
  return { type: 'FeatureCollection', features };
}

export function serializeGeoJSON(features = []) {
  return JSON.stringify(toFeatureCollection(features), null, 2);
}
