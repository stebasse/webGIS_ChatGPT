export { transformCoord, formatCoordinate, getCrsCode, getCrsDefinition, getCrsInfo } from '../../services/crsService';

export function transformGeometry(geometry, transformCoordinate) {
  if (!geometry || typeof transformCoordinate !== 'function') return geometry;
  const mapCoords = coords => {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') return transformCoordinate(coords);
    return coords.map(mapCoords);
  };
  return { ...geometry, coordinates: mapCoords(geometry.coordinates) };
}
