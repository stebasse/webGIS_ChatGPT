import { denormalizeProjectDocument } from './projectModel.js';

export const selectLayers = (project) => denormalizeProjectDocument(project).layers;
export const selectFeatures = (project) => denormalizeProjectDocument(project).features;
export const selectSettings = (project) => project?.settings || {};
export const selectSelectedLayerId = (project) => project?.ui?.selectedLayerId || null;
export const selectActiveLayer = (project) => selectLayers(project).find(layer => layer.id === selectSelectedLayerId(project)) || null;
