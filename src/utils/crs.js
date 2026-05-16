const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const GRS80_F = 1 / 298.257222101;

export function normalizeCrsCode(code) {
  const raw = String(code || 'EPSG:4326').trim().toUpperCase();
  const digits = raw.replace('EPSG:', '').replace(/[^0-9]/g, '');
  return digits ? `EPSG:${digits}` : raw;
}

function isFiniteCoord(coord) {
  return Array.isArray(coord) && Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
}

function lonLatToWebMercator([lon, lat]) {
  const x = WGS84_A * lon * Math.PI / 180;
  const safeLat = Math.max(Math.min(lat, 89.9999), -89.9999);
  const y = WGS84_A * Math.log(Math.tan(Math.PI / 4 + safeLat * Math.PI / 360));
  return [x, y];
}

function transverseMercator([lon, lat], { zone, south = false, lon0, k0 = 0.9996, x0 = 500000, y0 = 0, ellipsoid = 'WGS84' }) {
  const f = ellipsoid === 'GRS80' ? GRS80_F : WGS84_F;
  const a = WGS84_A;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  const lambda0 = ((lon0 ?? (zone * 6 - 183)) * Math.PI / 180);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = ep2 * cosPhi * cosPhi;
  const A = cosPhi * (lambda - lambda0);

  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M = a * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi)
    - (35 * e6 / 3072) * Math.sin(6 * phi)
  );

  const x = x0 + k0 * N * (
    A + (1 - T + C) * Math.pow(A, 3) / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120
  );

  let y = y0 + k0 * (
    M + N * tanPhi * (
      A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720
    )
  );

  if (south) y += 10000000;
  return [x, y];
}

export function getCrsDefinition(settings = {}) {
  const code = normalizeCrsCode(settings.crsCode);
  const epsg = Number(code.replace('EPSG:', ''));

  if (!settings.crsOverride || code === 'EPSG:4326') {
    return { code: 'EPSG:4326', name: settings.crsName || 'WGS 84', units: 'degrees', transformable: true, note: 'WGS84 lon/lat' };
  }
  if (code === 'EPSG:3857') {
    return { code, name: settings.crsName || 'WGS 84 / Pseudo-Mercator', units: 'm', transformable: true, type: 'mercator' };
  }
  if (epsg >= 32601 && epsg <= 32660) {
    return { code, name: settings.crsName || `WGS 84 / UTM zone ${epsg - 32600}N`, units: 'm', transformable: true, type: 'utm', zone: epsg - 32600, south: false, ellipsoid: 'WGS84' };
  }
  if (epsg >= 32701 && epsg <= 32760) {
    return { code, name: settings.crsName || `WGS 84 / UTM zone ${epsg - 32700}S`, units: 'm', transformable: true, type: 'utm', zone: epsg - 32700, south: true, ellipsoid: 'WGS84' };
  }
  if (epsg >= 25801 && epsg <= 25860) {
    return { code, name: settings.crsName || `ETRS89 / UTM zone ${epsg - 25800}N`, units: 'm', transformable: true, type: 'utm', zone: epsg - 25800, south: false, ellipsoid: 'GRS80' };
  }
  if (code === 'EPSG:3003') {
    return { code, name: settings.crsName || 'Monte Mario / Italy zone 1', units: 'm', transformable: true, type: 'tmerc', lon0: 9, k0: 0.9996, x0: 1500000, y0: 0, ellipsoid: 'WGS84', note: 'Approximate browser transform; no grid datum shift.' };
  }
  if (code === 'EPSG:3004') {
    return { code, name: settings.crsName || 'Monte Mario / Italy zone 2', units: 'm', transformable: true, type: 'tmerc', lon0: 15, k0: 0.9996, x0: 2520000, y0: 0, ellipsoid: 'WGS84', note: 'Approximate browser transform; no grid datum shift.' };
  }
  return { code, name: settings.crsName || code, units: 'unknown', transformable: false, note: 'CRS stored as metadata; projection formula not bundled.' };
}

export function projectLonLat(coord, settings = {}) {
  if (!isFiniteCoord(coord)) return coord;
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.code === 'EPSG:4326') return [...coord];
  if (def.type === 'mercator') return lonLatToWebMercator(coord);
  if (def.type === 'utm') return transverseMercator(coord, def);
  if (def.type === 'tmerc') return transverseMercator(coord, def);
  return [...coord];
}

export function formatProjectedCoordinate(coord, settings = {}) {
  if (!isFiniteCoord(coord)) return '';
  const def = getCrsDefinition(settings);
  const [x, y] = projectLonLat(coord, settings);
  if (def.code === 'EPSG:4326') return `Lat ${coord[1].toFixed(6)}, Lon ${coord[0].toFixed(6)} · ${def.code}`;
  if (!def.transformable) return `Lat ${coord[1].toFixed(6)}, Lon ${coord[0].toFixed(6)} · ${def.code} metadata`;
  return `E ${x.toFixed(2)} · N ${y.toFixed(2)} · ${def.code}`;
}

export function measureProjectedDistance(coords, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.units !== 'm' || coords.length < 2) return null;
  const projected = coords.map(c => projectLonLat(c, settings));
  return projected.slice(1).reduce((sum, c, i) => {
    const prev = projected[i];
    return sum + Math.hypot(c[0] - prev[0], c[1] - prev[1]);
  }, 0);
}

export function measureProjectedArea(coords, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.units !== 'm' || coords.length < 3) return null;
  const projected = coords.map(c => projectLonLat(c, settings));
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function transformGeometryToProjectCrs(geometry, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!geometry || !def.transformable || def.code === 'EPSG:4326') return geometry;
  const transformCoord = c => {
    const [x, y] = projectLonLat([c[0], c[1]], settings);
    return c.length > 2 ? [x, y, ...c.slice(2)] : [x, y];
  };
  const transformNested = value => Array.isArray(value?.[0]) ? value.map(transformNested) : transformCoord(value);
  return { ...geometry, coordinates: transformNested(geometry.coordinates) };
}
