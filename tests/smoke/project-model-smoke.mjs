import assert from 'node:assert/strict';
import { createProjectDocument, denormalizeProjectDocument } from '../../src/state/project/projectModel.js';
import { projectReducer } from '../../src/state/project/projectReducer.js';
import { createSnapIndex, findNearestSnapCandidate } from '../../src/domain/gis/snapEngine.js';

const layers = [{ id: 'layer-1', name: 'Test', type: 'Vector - Point' }];
const features = [{ type: 'Feature', properties: { id: 1, layerId: 'layer-1' }, geometry: { type: 'Point', coordinates: [12, 45] } }];
const project = createProjectDocument({ layers, features, settings: { language: 'it', projectCrs: 'EPSG:4326' }, selectedLayerId: 'layer-1' });
assert.equal(denormalizeProjectDocument(project).layers.length, 1);
assert.equal(denormalizeProjectDocument(project).features.length, 1);
const updated = projectReducer(project, { type: 'project/update-settings', payload: { units: 'imperial' } });
assert.equal(updated.settings.units, 'imperial');
const index = createSnapIndex(features);
const candidate = findNearestSnapCandidate({ pointerLngLat: [12.00001, 45.00001], tolerance: 0.001, index });
assert.equal(candidate.featureId, 1);
console.log('Smoke tests passed');
