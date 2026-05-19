import { createProjectDocument } from './projectModel.js';

function touch(project) {
  return { ...project, meta: { ...project.meta, updatedAt: new Date().toISOString() } };
}

export function projectReducer(project, action) {
  switch (action.type) {
    case 'project/load':
      return action.payload;
    case 'project/update-settings':
      return touch({ ...project, settings: { ...project.settings, ...action.payload } });
    case 'project/replace-layers': {
      const layers = action.payload || [];
      return touch({
        ...project,
        layerOrder: layers.map(layer => layer.id),
        layersById: Object.fromEntries(layers.map(layer => [layer.id, layer])),
      });
    }
    case 'project/replace-features': {
      const features = action.payload || [];
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
    case 'project/select-layer':
      return { ...project, ui: { ...project.ui, selectedLayerId: action.payload } };
    case 'project/reset-legacy':
      return createProjectDocument(action.payload || {});
    default:
      return project;
  }
}
