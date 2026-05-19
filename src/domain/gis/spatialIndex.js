export function buildLinearSpatialIndex(items = []) {
  return items.map(item => ({ ...item }));
}

export function searchByBBox(index = [], bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  return index.filter(item => {
    const [x, y] = item.coord || [];
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}
