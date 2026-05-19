export function serializeCsv(features = []) {
  const rows = features.map(feature => feature.properties || {});
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n');
}
