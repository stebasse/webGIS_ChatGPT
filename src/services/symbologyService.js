// Resolve a feature's display color given its layer and symbology rules.
export function resolveFeatureColor(feature, layer) {
  if (!layer) return '#0ea5e9';
  const base = layer.colorHex || '#0ea5e9';
  const sym = layer.symbology;
  if (!sym || sym.mode !== 'categorized' || !sym.attribute || !sym.rules?.length) return base;
  const attrVal = String(feature.properties?.[sym.attribute] ?? '');
  const match = sym.rules.find(r => String(r.value) === attrVal);
  return match ? match.color : base;
}
