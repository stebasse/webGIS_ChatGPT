import { areaInCrs, distanceInCrs } from './crsService';

const EARTH_RADIUS_METERS = 6371008.8;

export const toRad = (deg) => deg * Math.PI / 180;

export function segmentDistanceMeters(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function measureDistanceMeters(coords, { useProjectCrs = false, projectCrs = 'EPSG:4326' } = {}) {
  const projected = useProjectCrs ? distanceInCrs(coords, projectCrs) : null;
  if (typeof projected === 'number') return projected;
  return coords.slice(1).reduce((sum, c, i) => sum + segmentDistanceMeters(coords[i], c), 0);
}

export function measureAreaSqMeters(coords, { useProjectCrs = false, projectCrs = 'EPSG:4326' } = {}) {
  if (coords.length < 3) return 0;
  const projectedArea = useProjectCrs ? areaInCrs(coords, projectCrs) : null;
  if (typeof projectedArea === 'number') return projectedArea;

  const lat0 = toRad(coords.reduce((sum, c) => sum + c[1], 0) / coords.length);
  const projected = coords.map(([lng, lat]) => [
    EARTH_RADIUS_METERS * toRad(lng) * Math.cos(lat0),
    EARTH_RADIUS_METERS * toRad(lat),
  ]);

  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function formatMeasureValue(mode, coords, { units = 'metric', useProjectCrs = false, projectCrs = 'EPSG:4326' } = {}) {
  if (!mode || coords.length === 0) return '';
  if (mode === 'Distance') {
    const m = measureDistanceMeters(coords, { useProjectCrs, projectCrs });
    if (units === 'imperial') {
      const ft = m * 3.28084;
      return ft >= 5280 ? `${(ft / 5280).toFixed(2)} mi` : `${ft.toFixed(1)} ft`;
    }
    return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m.toFixed(2)} m`;
  }

  const sqm = measureAreaSqMeters(coords, { useProjectCrs, projectCrs });
  if (units === 'imperial') {
    const sqft = sqm * 10.7639;
    return sqft >= 43560 ? `${(sqft / 43560).toFixed(3)} ac` : `${sqft.toFixed(1)} ft²`;
  }
  return sqm >= 10000 ? `${(sqm / 10000).toFixed(4)} ha` : `${sqm.toFixed(2)} m²`;
}
