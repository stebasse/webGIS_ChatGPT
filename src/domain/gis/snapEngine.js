export function createSnapIndex(features = []) {
  return features.flatMap(feature => extractVertices(feature).map(vertex => ({ ...vertex, featureId: feature.properties?.id })));
}

export function findNearestSnapCandidate({ pointerLngLat, tolerance = 0.0002, index = [] }) {
  if (!pointerLngLat) return null;
  let best = null;
  for (const item of index) {
    const dx = item.coord[0] - pointerLngLat[0];
    const dy = item.coord[1] - pointerLngLat[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { ...item, distance };
  }
  return best;
}

function extractVertices(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  const out = [];
  const visit = coords => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') out.push({ coord: coords });
    else coords.forEach(visit);
  };
  visit(geometry.coordinates);
  return out;
}
