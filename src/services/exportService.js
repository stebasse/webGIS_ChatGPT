import { getCrsCode, transformFeature, downloadTextFile, prjTextForCRS } from './crsService';
import { writeTextToDirectory, writeTextToFileHandle, chooseWritableFile, canChooseOutputFile } from './fileSystemAccess';

function buildExportPayload({ features, layers, layerIdFilter, options, projectCrs, getFeatureSourceCrs }) {
  const layer = layerIdFilter ? layers.find(l => String(l.id) === String(layerIdFilter)) : null;
  let exportCrs = getCrsCode(options.crs || projectCrs);
  if (options.crsMode === 'wgs84') exportCrs = 'EPSG:4326';
  if (options.crsMode === 'layer' && layer) exportCrs = getCrsCode(layer.crs || layer.sourceCrs || 'EPSG:4326');
  if (options.crsMode === 'project') exportCrs = projectCrs;

  const extension = String(options.extension || 'geojson').replace(/^\./, '').toLowerCase();
  const layerName = layerIdFilter ? (layer?.name || 'layer') : 'all_layers';
  const defaultBase = `${layerName}_${exportCrs.replace(':','')}_${new Date().toISOString().split('T')[0]}`;
  const filenameBase = (options.filename || defaultBase).replace(/\.[^.]+$/, '');

  const exportFeatures = features.map(f => {
    const srcLayer = layers.find(l => l.id === f.properties.layerId);
    const sourceCrs = getFeatureSourceCrs(f, srcLayer);
    return sourceCrs === exportCrs ? f : transformFeature(f, sourceCrs, exportCrs);
  });

  if (extension === 'csv') {
    const keys = [...new Set(exportFeatures.flatMap(f => Object.keys(f.properties || {})))];
    const header = [...keys, 'geometry_type', 'coordinates', 'crs'];
    const rows = exportFeatures.map(f => [
      ...keys.map(k => JSON.stringify(f.properties?.[k] ?? '')),
      JSON.stringify(f.geometry?.type || ''),
      JSON.stringify(JSON.stringify(f.geometry?.coordinates ?? null)),
      JSON.stringify(exportCrs),
    ].join(','));
    return {
      content: [header.join(','), ...rows].join('\n'),
      mime: 'text/csv',
      filename: `${filenameBase}.${extension}`,
      filenameBase,
      extension,
      exportCrs,
    };
  }

  const geojson = {
    type: 'FeatureCollection',
    name: layerName,
    crs: { type: 'name', properties: { name: exportCrs } },
    features: exportFeatures,
  };
  return {
    content: JSON.stringify(geojson, null, 2),
    mime: 'application/geo+json',
    filename: `${filenameBase}.${extension === 'json' ? 'json' : 'geojson'}`,
    filenameBase,
    extension,
    exportCrs,
  };
}

async function saveExport({ payload, options }) {
  const { content, mime, filename, filenameBase, extension, exportCrs } = payload;
  if (options.directoryHandle) {
    await writeTextToDirectory(options.directoryHandle, filename, content, mime);
    if (extension !== 'csv') await writeTextToDirectory(options.directoryHandle, `${filenameBase}.prj.txt`, prjTextForCRS(exportCrs), 'text/plain');
    return;
  }

  if (options.fileHandle) {
    await writeTextToFileHandle(options.fileHandle, content, mime);
    if (extension !== 'csv') downloadTextFile(`${filenameBase}.prj.txt`, prjTextForCRS(exportCrs), 'text/plain');
    return;
  }

  if (options.useSaveFilePicker && canChooseOutputFile()) {
    const accept = extension === 'csv'
      ? { 'text/csv': ['.csv'] }
      : extension === 'json'
        ? { 'application/json': ['.json'], 'text/plain': ['.json'] }
        : { 'application/geo+json': ['.geojson'], 'application/json': ['.geojson'], 'text/plain': ['.geojson'] };
    const handle = await chooseWritableFile({ suggestedName: filename, description: 'GIS export', accept });
    await writeTextToFileHandle(handle, content, mime);
    if (extension !== 'csv') downloadTextFile(`${filenameBase}.prj.txt`, prjTextForCRS(exportCrs), 'text/plain');
    return;
  }

  downloadTextFile(filename, content, mime);
  if (extension !== 'csv') downloadTextFile(`${filenameBase}.prj.txt`, prjTextForCRS(exportCrs), 'text/plain');
}

export async function exportFeatures(options = {}, context) {
  const { collectedPoints, layers, projectCrs, getFeatureSourceCrs } = context;
  const layerIdFilter = typeof options === 'object' ? options.layerId : options;
  const features = layerIdFilter
    ? collectedPoints.filter(f => String(f.properties.layerId) === String(layerIdFilter))
    : collectedPoints;

  if (features.length === 0) {
    alert('Nessuna feature da esportare.');
    return;
  }

  const payload = buildExportPayload({ features, layers, layerIdFilter, options, projectCrs, getFeatureSourceCrs });

  try {
    await saveExport({ payload, options });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error(err);
      alert('Export non riuscito. Uso download standard.');
      downloadTextFile(payload.filename, payload.content, payload.mime);
      if (payload.extension !== 'csv') downloadTextFile(`${payload.filenameBase}.prj.txt`, prjTextForCRS(payload.exportCrs), 'text/plain');
    }
  }
}
