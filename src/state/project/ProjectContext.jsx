import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { LAYERS } from '../../config/constants';
import { usePersistentState } from '../../hooks/usePersistentState';
import { DEFAULT_SETTINGS } from '../defaults';
import { createProjectDocument, denormalizeProjectDocument } from './projectModel';
import { projectReducer } from './projectReducer';

const ProjectStateContext = createContext(null);
const ProjectDispatchContext = createContext(null);
const ProjectLegacyContext = createContext(null);

export function ProjectProvider({ children }) {
  const [legacyLayers, persistLayers] = usePersistentState('stitch_gis_layers', LAYERS);
  const [legacyFeatures, persistFeatures] = usePersistentState('stitch_gis_points', []);
  const [legacySettings, persistSettings] = usePersistentState('stitch_gis_settings', DEFAULT_SETTINGS);
  const [legacySelectedLayerId, persistSelectedLayerId] = usePersistentState('stitch_gis_selected_layer', null);

  const [project, dispatch] = useReducer(
    projectReducer,
    null,
    () => createProjectDocument({
      layers: legacyLayers,
      features: legacyFeatures,
      settings: legacySettings,
      selectedLayerId: legacySelectedLayerId,
    })
  );

  const denormalized = useMemo(() => denormalizeProjectDocument(project), [project]);

  useEffect(() => persistLayers(denormalized.layers), [denormalized.layers, persistLayers]);
  useEffect(() => persistFeatures(denormalized.features), [denormalized.features, persistFeatures]);
  useEffect(() => persistSettings(denormalized.settings), [denormalized.settings, persistSettings]);
  useEffect(() => persistSelectedLayerId(denormalized.selectedLayerId), [denormalized.selectedLayerId, persistSelectedLayerId]);

  useEffect(() => {
    if (denormalized.selectedLayerId !== null && !denormalized.layers.find(l => l.id === denormalized.selectedLayerId)) {
      dispatch({ type: 'project/select-layer', payload: denormalized.layers.length > 0 ? denormalized.layers[0].id : null });
    }
  }, [denormalized.layers, denormalized.selectedLayerId]);

  useEffect(() => {
    window.__GIS_DEBUG__ = denormalized.settings.logLevel === 'high';
  }, [denormalized.settings.logLevel]);

  const legacyApi = useMemo(() => ({
    layers: denormalized.layers,
    setLayers: updater => dispatch({
      type: 'project/replace-layers',
      payload: updater,
    }),
    collectedPoints: denormalized.features,
    setCollectedPoints: updater => dispatch({
      type: 'project/replace-features',
      payload: updater,
    }),
    settings: denormalized.settings,
    setSettings: updater => dispatch({
      type: 'project/update-settings',
      payload: updater,
    }),
    selectedLayerId: denormalized.selectedLayerId,
    setSelectedLayerId: updater => dispatch({
      type: 'project/select-layer',
      payload: updater,
    }),
    projectDocument: project,
  }), [denormalized, project]);

  return (
    <ProjectStateContext.Provider value={project}>
      <ProjectDispatchContext.Provider value={dispatch}>
        <ProjectLegacyContext.Provider value={legacyApi}>{children}</ProjectLegacyContext.Provider>
      </ProjectDispatchContext.Provider>
    </ProjectStateContext.Provider>
  );
}

export function useProjectDocument() {
  const value = useContext(ProjectStateContext);
  if (!value) throw new Error('useProjectDocument must be used inside ProjectProvider');
  return value;
}

export function useProjectDispatch() {
  const value = useContext(ProjectDispatchContext);
  if (!value) throw new Error('useProjectDispatch must be used inside ProjectProvider');
  return value;
}

export function useProjectLegacyState() {
  const value = useContext(ProjectLegacyContext);
  if (!value) throw new Error('useProjectLegacyState must be used inside ProjectProvider');
  return value;
}
