export function beginEdit(feature) {
  return { original: feature, working: structuredClone ? structuredClone(feature) : JSON.parse(JSON.stringify(feature)) };
}

export function commitEdit(session) {
  return session?.working || null;
}

export function cancelEdit(session) {
  return session?.original || null;
}
