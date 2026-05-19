export const getLayerGeometryKind = (layer) => {
  const raw = String(layer?.type || layer?.geometryType || layer?.geometry || '').toLowerCase();
  if (raw.includes('wms') || String(layer?.format || '').toLowerCase() === 'wms') return 'Raster';
  if (raw.includes('raster') || raw.includes('geotiff')) return 'Raster';
  if (raw.includes('table') || raw.includes('tabella')) return 'Table';
  if (raw.includes('point') || raw.includes('punto')) return 'Point';
  if (raw.includes('line') || raw.includes('linea')) return 'Line';
  if (raw.includes('polygon') || raw.includes('poligono')) return 'Polygon';
  return null;
};
