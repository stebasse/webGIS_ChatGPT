import { createProjectDocument } from './projectModel.js';

function touch(project) {
  return { ...project, meta: { ...project.meta, updatedAt: new Date().toISOString() } };
}

function getOrderedLayers(project) {
  return (project.layerOrder || []).map(id => project.layersById?.[id]).filter(Boolean);
}

function getOrderedFeatures(project) {
  const layers = getOrderedLayers(project);
  const featureIds = layers.flatMap(layer => project.featureIdsByLayer?.[layer.id] || []);
  const seen = new Set();
  const ordered = featureIds
    .map(id => project.featuresById?.[id])
    .filter(Boolean)
    .filter(feature => {
      const id = feature.properties?.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  const orphan = Object.values(project.featuresById || {}).filter(feature => !seen.has(feature.properties?.id));
  return [...ordered, ...orphan];
}

function resolvePayload(payload, currentValue) {
  return typeof payload === 'function' ? payload(currentValue) : payload;
}

export function projectReducer(project, action) {
  switch (action.type) {
    case 'project/load':
      return action.payload;
    case 'project/update-settings': {
      const nextSettings = resolvePayload(action.payload, project.settings || {});
      return touch({ ...project, settings: { ...project.settings, ...nextSettings } });
    }
    case 'project/replace-layers': {
      const layers = resolvePayload(action.payload, getOrderedLayers(project)) || [];
      return touch({
        ...project,
        layerOrder: layers.map(layer => layer.id),
        layersById: Object.fromEntries(layers.map(layer => [layer.id, layer])),
      });
    }
    case 'project/replace-features': {
      const features = resolvePayload(action.payload, getOrderedFeatures(project)) || [];
      return touch({
        ...project,
        featuresById: Object.fromEntries(features.map(feature => [feature.properties?.id, feature]).filter(([id]) => id !== undefined && id !== null)),
        featureIdsByLayer: features.reduce((acc, feature) => {
          const layerId = feature.properties?.layerId;
          const featureId = feature.properties?.id;
          if (layerId === undefined || featureId === undefined || featureId === null) return acc;
          acc[layerId] = [...(acc[layerId] || []), featureId];
          return acc;
        }, {}),
      });
    }
    case 'project/select-layer': {
      const selectedLayerId = resolvePayload(action.payload, project.ui?.selectedLayerId ?? null);
      return { ...project, ui: { ...project.ui, selectedLayerId } };
    }
    case 'project/reset-legacy':
      return createProjectDocument(action.payload || {});
    default:
      return project;
  }
}
