export function buildProjectArchiveManifest(projectDocument) {
  return {
    app: 'stitch-gis-app',
    schemaVersion: projectDocument?.meta?.schemaVersion || 1,
    createdAt: projectDocument?.meta?.createdAt,
    updatedAt: projectDocument?.meta?.updatedAt,
    projectId: projectDocument?.meta?.id,
    projectName: projectDocument?.meta?.name,
    canonicalGeometryCrs: 'EPSG:4326',
    projectCrs: projectDocument?.settings?.projectCrs || 'EPSG:4326',
  };
}

export function serializeProjectDocument(projectDocument) {
  return JSON.stringify({ manifest: buildProjectArchiveManifest(projectDocument), project: projectDocument }, null, 2);
}

export function parseProjectDocumentArchive(text) {
  const parsed = JSON.parse(text);
  return parsed.project || parsed;
}
