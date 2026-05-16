import proj4 from 'proj4';

const CRS_LABELS = {
  'EPSG:4326': 'WGS 84 geographic',
  'EPSG:3857': 'WGS 84 / Pseudo-Mercator',
  'EPSG:3003': 'Monte Mario / Italy zone 1',
  'EPSG:3004': 'Monte Mario / Italy zone 2',
  'EPSG:6706': 'RDN2008 / Italy zone',
};

const COMMON_DEFS = {
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs +type=crs',
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
  'EPSG:3003': '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs +type=crs',
  'EPSG:3004': '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9996 +x_0=2520000 +y_0=0 +ellps=intl +towgs84=-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68 +units=m +no_defs +type=crs',
  'EPSG:6706': '+proj=tmerc +lat_0=0 +lon_0=12 +k=0.9996 +x_0=7000000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs',
};

export const FALLBACK_CRS = [
  { code: 'EPSG:4326', name: 'WGS 84 geographic' },
  { code: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator' },
  { code: 'EPSG:32632', name: 'WGS 84 / UTM zone 32N' },
  { code: 'EPSG:32633', name: 'WGS 84 / UTM zone 33N' },
  { code: 'EPSG:32732', name: 'WGS 84 / UTM zone 32S' },
  { code: 'EPSG:32733', name: 'WGS 84 / UTM zone 33S' },
  { code: 'EPSG:25832', name: 'ETRS89 / UTM zone 32N' },
  { code: 'EPSG:25833', name: 'ETRS89 / UTM zone 33N' },
  { code: 'EPSG:3003', name: 'Monte Mario / Italy zone 1' },
  { code: 'EPSG:3004', name: 'Monte Mario / Italy zone 2' },
  { code: 'EPSG:6706', name: 'RDN2008 / Italy zone' },
];

function normalize(code = 'EPSG:4326') {
  const clean = String(code).trim().toUpperCase();
  if (/^\d+$/.test(clean)) return `EPSG:${clean}`;
  if (/^EPSG:\d+$/.test(clean)) return clean;
  return clean;
}

function utmDef(code) {
  const epsg = Number(String(code).replace('EPSG:', ''));
  if (epsg >= 32601 && epsg <= 32660) {
    const zone = epsg - 32600;
    return `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs +type=crs`;
  }
  if (epsg >= 32701 && epsg <= 32760) {
    const zone = epsg - 32700;
    return `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs +type=crs`;
  }
  if (epsg >= 25801 && epsg <= 25860) {
    const zone = epsg - 25800;
    return `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs +type=crs`;
  }
  return null;
}

export function getCrsCode(code) {
  return normalize(code || 'EPSG:4326');
}

export function getProjDefinition(code) {
  const key = normalize(code);
  return COMMON_DEFS[key] || utmDef(key) || null;
}

export function ensureCrs(code) {
  const key = normalize(code);
  if (key === 'EPSG:4326') return true;
  if (proj4.defs(key)) return true;
  const def = getProjDefinition(key);
  if (!def) return false;
  proj4.defs(key, def);
  return true;
}

export function canTransform(code) {
  return ensureCrs(code);
}

export function getCrsInfo(code) {
  const key = normalize(code);
  const epsg = Number(key.replace('EPSG:', ''));
  let name = CRS_LABELS[key];
  if (!name && epsg >= 32601 && epsg <= 32660) name = `WGS 84 / UTM zone ${epsg - 32600}N`;
  if (!name && epsg >= 32701 && epsg <= 32760) name = `WGS 84 / UTM zone ${epsg - 32700}S`;
  if (!name && epsg >= 25801 && epsg <= 25860) name = `ETRS89 / UTM zone ${epsg - 25800}N`;
  return {
    code: key,
    name: name || 'Custom EPSG / metadata only until PROJ definition is available',
    definition: getProjDefinition(key),
    transformable: canTransform(key),
  };
}

export function transformCoord(coord, from = 'EPSG:4326', to = 'EPSG:4326') {
  const source = normalize(from);
  const target = normalize(to);
  if (!coord || source === target) return coord;
  if (!ensureCrs(source) || !ensureCrs(target)) return coord;
  try {
    return proj4(source, target, coord);
  } catch (err) {
    console.warn('CRS transform failed', source, target, err);
    return coord;
  }
}

export function transformGeometry(geometry, from = 'EPSG:4326', to = 'EPSG:4326') {
  if (!geometry || !geometry.coordinates) return geometry;
  const convert = (c) => transformCoord(c, from, to);
  if (geometry.type === 'Point') return { ...geometry, coordinates: convert(geometry.coordinates) };
  if (geometry.type === 'LineString') return { ...geometry, coordinates: geometry.coordinates.map(convert) };
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(ring => ring.map(convert)) };
  if (geometry.type === 'MultiPoint') return { ...geometry, coordinates: geometry.coordinates.map(convert) };
  if (geometry.type === 'MultiLineString') return { ...geometry, coordinates: geometry.coordinates.map(line => line.map(convert)) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(ring => ring.map(convert))) };
  return geometry;
}

export function transformFeature(feature, from = 'EPSG:4326', to = 'EPSG:4326') {
  if (!feature?.geometry) return feature;
  return {
    ...feature,
    properties: { ...(feature.properties || {}), sourceCrs: from, exportCrs: to },
    geometry: transformGeometry(feature.geometry, from, to),
  };
}

export function formatCoordinate(coord, crs = 'EPSG:4326') {
  if (!coord) return '';
  const key = normalize(crs);
  if (key === 'EPSG:4326') return `${coord[1].toFixed(6)}, ${coord[0].toFixed(6)}`;
  return `E ${coord[0].toFixed(3)}  N ${coord[1].toFixed(3)}  ${key}`;
}

export function distanceInCrs(coords, crs = 'EPSG:4326') {
  if (!coords || coords.length < 2) return 0;
  const key = normalize(crs);
  if (key === 'EPSG:4326' || !ensureCrs(key)) return null;
  const projected = coords.map(c => transformCoord(c, 'EPSG:4326', key));
  return projected.slice(1).reduce((sum, p, i) => {
    const prev = projected[i];
    return sum + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
  }, 0);
}

export function areaInCrs(coords, crs = 'EPSG:4326') {
  if (!coords || coords.length < 3) return 0;
  const key = normalize(crs);
  if (key === 'EPSG:4326' || !ensureCrs(key)) return null;
  const projected = coords.map(c => transformCoord(c, 'EPSG:4326', key));
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}
