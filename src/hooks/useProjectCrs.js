import { useCallback, useEffect, useMemo } from 'react';

import { getCrsCode, getCrsInfo, transformCoord, transformGeometry } from '../services/crsService';

export function useProjectCrs({ settings, setLayers }) {
  const projectCrs = settings.crsOverride ? (settings.projectCrs || 'EPSG:4326') : 'EPSG:4326';
  const projectCrsInfo = useMemo(() => getCrsInfo(projectCrs), [projectCrs]);

  useEffect(() => {
    setLayers(prev => prev.map(layer => ({
      ...layer,
      crs: getCrsCode(layer.crs || layer.sourceCrs || 'EPSG:4326'),
      sourceCrs: getCrsCode(layer.sourceCrs || layer.crs || 'EPSG:4326'),
      displayCrs: projectCrs,
    })));
  }, [projectCrs, setLayers]);

  const getFeatureSourceCrs = useCallback((feature, layer) => (
    getCrsCode(feature?.properties?.sourceCrs || layer?.sourceCrs || layer?.crs || 'EPSG:4326')
  ), []);

  const geometryToWgs84 = useCallback((feature, layer) => {
    const source = getFeatureSourceCrs(feature, layer);
    return source === 'EPSG:4326' ? feature.geometry : transformGeometry(feature.geometry, source, 'EPSG:4326');
  }, [getFeatureSourceCrs]);

  const coordinatesToLayerCrs = useCallback((coords, layer) => {
    const layerCrs = getCrsCode(layer?.crs || layer?.sourceCrs || 'EPSG:4326');
    return layerCrs === 'EPSG:4326' ? coords : transformCoord(coords, 'EPSG:4326', layerCrs);
  }, []);

  return {
    projectCrs,
    projectCrsInfo,
    getFeatureSourceCrs,
    geometryToWgs84,
    coordinatesToLayerCrs,
  };
}
