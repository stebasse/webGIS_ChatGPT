import { useEffect } from 'react';

import { LAYERS } from '../config/constants';
import { usePersistentState } from '../hooks/usePersistentState';
import { DEFAULT_SETTINGS } from './defaults';

export function useProjectState() {
  const [layers, setLayers] = usePersistentState('stitch_gis_layers', LAYERS);
  const [collectedPoints, setCollectedPoints] = usePersistentState('stitch_gis_points', []);
  const [settings, setSettings] = usePersistentState('stitch_gis_settings', DEFAULT_SETTINGS);
  const [selectedLayerId, setSelectedLayerId] = usePersistentState('stitch_gis_selected_layer', null);

  useEffect(() => {
    if (selectedLayerId !== null && !layers.find(l => l.id === selectedLayerId)) {
      setSelectedLayerId(layers.length > 0 ? layers[0].id : null);
    }
  }, [layers, selectedLayerId, setSelectedLayerId]);

  useEffect(() => {
    window.__GIS_DEBUG__ = settings.logLevel === 'high';
  }, [settings.logLevel]);

  return {
    layers,
    setLayers,
    collectedPoints,
    setCollectedPoints,
    settings,
    setSettings,
    selectedLayerId,
    setSelectedLayerId,
  };
}
