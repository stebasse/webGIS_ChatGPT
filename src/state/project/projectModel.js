export const PROJECT_SCHEMA_VERSION = 1;
export const CANONICAL_GEOMETRY_CRS = 'EPSG:4326';

export function createProjectDocument({ layers = [], features = [], settings, selectedLayerId = null, name = 'WebGIS Project' } = {}) {
  const now = new Date().toISOString();
  return {
    meta: {
      id: `prj_${Date.now()}`,
      name,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      ...settings,
      canonicalGeometryCrs: CANONICAL_GEOMETRY_CRS,
    },
    layerOrder: layers.map(layer => layer.id),
    layersById: Object.fromEntries(layers.map(layer => [layer.id, layer])),
    featuresById: Object.fromEntries(features.map(feature => [feature.properties?.id, feature]).filter(([id]) => id !== undefined && id !== null)),
    featureIdsByLayer: features.reduce((acc, feature) => {
      const layerId = feature.properties?.layerId;
      const featureId = feature.properties?.id;
      if (layerId === undefined || featureId === undefined || featureId === null) return acc;
      acc[layerId] = [...(acc[layerId] || []), featureId];
      return acc;
    }, {}),
    ui: { selectedLayerId },
  };
}

export function normalizeLegacyProject({ layers = [], features = [], settings, selectedLayerId = null }) {
  return createProjectDocument({ layers, features, settings, selectedLayerId });
}

export function denormalizeProjectDocument(project) {
  if (!project?.layersById) return { layers: [], features: [], settings: project?.settings || {}, selectedLayerId: null };
  const layers = (project.layerOrder || []).map(id => project.layersById[id]).filter(Boolean);
  const featureIds = layers.flatMap(layer => project.featureIdsByLayer?.[layer.id] || []);
  const seen = new Set();
  const orderedFeatures = featureIds
    .map(id => project.featuresById?.[id])
    .filter(Boolean)
    .filter(feature => {
      const id = feature.properties?.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  const orphanFeatures = Object.values(project.featuresById || {}).filter(feature => !seen.has(feature.properties?.id));
  return {
    layers,
    features: [...orderedFeatures, ...orphanFeatures],
    settings: project.settings || {},
    selectedLayerId: project.ui?.selectedLayerId || null,
  };
}
