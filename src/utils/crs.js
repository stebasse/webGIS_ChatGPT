import proj4 from 'proj4';

export const WGS84 = 'EPSG:4326';
export const WEB_MERCATOR = 'EPSG:3857';

const FALLBACK_DEFS = {
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs +type=crs',
  'EPSG:3857': '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
  'EPSG:3003': '+proj=tmerc +lat_0=0 +lon_0=9 +k=0.9996 +x_0=1500000 +y_0=0 +ellps=intl +units=m +no_defs +type=crs',
  'EPSG:3004': '+proj=tmerc +lat_0=0 +lon_0=15 +k=0.9996 +x_0=2520000 +y_0=0 +ellps=intl +units=m +no_defs +type=crs',
  'EPSG:6706': '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
  'EPSG:7791': '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs +type=crs'
};

export function normalizeCrsCode(code) {
  const raw = String(code || WGS84).trim().toUpperCase();
  const digits = raw.replace('EPSG:', '').replace(/[^0-9]/g, '');
  return digits ? `EPSG:${digits}` : raw;
}

function epsgNumber(code) {
  return Number(normalizeCrsCode(code).replace('EPSG:', ''));
}

function isFiniteCoord(coord) {
  return Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1]));
}

function utmDef(epsg) {
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs +type=crs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs +type=crs`;
  if (epsg >= 25801 && epsg <= 25860) return `+proj=utm +zone=${epsg - 25800} +ellps=GRS80 +units=m +no_defs +type=crs`;
  return null;
}

function unitsFromProj4(def) {
  if (!def) return 'unknown';
  if (def.includes('+proj=longlat')) return 'degrees';
  const units = def.match(/\+units=([^\s]+)/)?.[1];
  return units || 'm';
}

function nameFromCode(code, fallbackName) {
  const epsg = epsgNumber(code);
  if (code === 'EPSG:4326') return fallbackName || 'WGS 84';
  if (code === 'EPSG:3857') return fallbackName || 'WGS 84 / Pseudo-Mercator';
  if (epsg >= 32601 && epsg <= 32660) return fallbackName || `WGS 84 / UTM zone ${epsg - 32600}N`;
  if (epsg >= 32701 && epsg <= 32760) return fallbackName || `WGS 84 / UTM zone ${epsg - 32700}S`;
  if (epsg >= 25801 && epsg <= 25860) return fallbackName || `ETRS89 / UTM zone ${epsg - 25800}N`;
  if (code === 'EPSG:3003') return fallbackName || 'Monte Mario / Italy zone 1';
  if (code === 'EPSG:3004') return fallbackName || 'Monte Mario / Italy zone 2';
  if (code === 'EPSG:6706') return fallbackName || 'RDN2008 geographic';
  if (code === 'EPSG:7791') return fallbackName || 'RDN2008 / UTM zone 32N';
  return fallbackName || code;
}

export function getProj4Definition(settingsOrCode = {}) {
  const code = typeof settingsOrCode === 'string'
    ? normalizeCrsCode(settingsOrCode)
    : normalizeCrsCode(settingsOrCode?.crsCode);

  const saved = typeof settingsOrCode === 'object' ? String(settingsOrCode?.crsProj4 || '').trim() : '';
  if (saved && saved.startsWith('+proj=')) return saved;
  return FALLBACK_DEFS[code] || utmDef(epsgNumber(code)) || null;
}

export function registerCrs(settingsOrCode = {}) {
  const code = typeof settingsOrCode === 'string'
    ? normalizeCrsCode(settingsOrCode)
    : normalizeCrsCode(settingsOrCode?.crsCode);
  const def = getProj4Definition(settingsOrCode);
  if (!def) return false;
  try {
    proj4.defs(code, def);
    return true;
  } catch (err) {
    console.warn('Invalid proj4 CRS definition', code, err);
    return false;
  }
}

export function getCrsDefinition(settings = {}) {
  const code = normalizeCrsCode(settings.crsCode || WGS84);
  const enabled = settings.crsOverride !== false;
  const def = enabled ? getProj4Definition(settings) : FALLBACK_DEFS[WGS84];
  const transformable = !!def && registerCrs({ ...settings, crsCode: code, crsProj4: def });
  return {
    code: enabled ? code : WGS84,
    name: nameFromCode(enabled ? code : WGS84, settings.crsName),
    proj4: def,
    units: unitsFromProj4(def),
    transformable,
    source: settings.crsSource || (def ? 'proj4' : 'metadata'),
    note: transformable ? 'CRS transformed with proj4.' : 'CRS stored as metadata only; proj4 definition missing.'
  };
}

export function transformCoord(coord, source = WGS84, target = WGS84, settings = {}) {
  if (!isFiniteCoord(coord)) return coord;
  const src = normalizeCrsCode(source);
  const dst = normalizeCrsCode(target);
  if (src === dst) return [Number(coord[0]), Number(coord[1])];
  const targetSettings = dst === normalizeCrsCode(settings?.crsCode) ? settings : { crsCode: dst, crsOverride: true };
  const sourceSettings = src === normalizeCrsCode(settings?.crsCode) ? settings : { crsCode: src, crsOverride: true };
  const okSrc = registerCrs(sourceSettings);
  const okDst = registerCrs(targetSettings);
  if (!okSrc || !okDst) return [Number(coord[0]), Number(coord[1])];
  try {
    const out = proj4(src, dst, [Number(coord[0]), Number(coord[1])]);
    return coord.length > 2 ? [out[0], out[1], ...coord.slice(2)] : out;
  } catch (err) {
    console.warn('CRS transform failed', src, dst, err);
    return [Number(coord[0]), Number(coord[1])];
  }
}

export function projectLonLat(coord, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.code === WGS84) return [...coord];
  return transformCoord(coord, WGS84, def.code, settings);
}

export function unprojectToLonLat(coord, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.code === WGS84) return [...coord];
  return transformCoord(coord, def.code, WGS84, settings);
}

export function formatProjectedCoordinate(coord, settings = {}) {
  if (!isFiniteCoord(coord)) return '';
  const def = getCrsDefinition(settings);
  if (!settings.crsOverride || def.code === WGS84) return `Lat ${Number(coord[1]).toFixed(6)}, Lon ${Number(coord[0]).toFixed(6)} · EPSG:4326`;
  if (!def.transformable) return `Lat ${Number(coord[1]).toFixed(6)}, Lon ${Number(coord[0]).toFixed(6)} · ${def.code} metadata`;
  const [x, y] = projectLonLat(coord, settings);
  return `E ${x.toFixed(2)} · N ${y.toFixed(2)} · ${def.code}`;
}

export function measureProjectedDistance(coords, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.units !== 'm' || coords.length < 2) return null;
  const projected = coords.map(c => projectLonLat(c, settings));
  return projected.slice(1).reduce((sum, c, i) => sum + Math.hypot(c[0] - projected[i][0], c[1] - projected[i][1]), 0);
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

function mapCoords(value, fn) {
  if (!Array.isArray(value)) return value;
  if (Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) return fn(value);
  return value.map(v => mapCoords(v, fn));
}

export function transformGeometry(geometry, sourceCrs = WGS84, targetCrs = WGS84, settings = {}) {
  if (!geometry?.coordinates) return geometry;
  const src = normalizeCrsCode(sourceCrs);
  const dst = normalizeCrsCode(targetCrs);
  if (src === dst) return geometry;
  return { ...geometry, coordinates: mapCoords(geometry.coordinates, c => transformCoord(c, src, dst, settings)) };
}

export function transformGeometryToProjectCrs(geometry, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!geometry || !def.transformable || def.code === WGS84) return geometry;
  return transformGeometry(geometry, WGS84, def.code, settings);
}

export function projectFeatureForExport(feature, settings = {}) {
  const def = getCrsDefinition(settings);
  if (!def.transformable || def.code === WGS84 || !feature?.geometry) return feature;
  return {
    ...feature,
    properties: { ...feature.properties, projectCrs: def.code, originalCrs: feature.properties?.crs || WGS84 },
    geometry: transformGeometryToProjectCrs(feature.geometry, settings)
  };
}

export function makePrjText(settings = {}) {
  const def = getCrsDefinition(settings);
  return def.proj4 || def.code;
}
