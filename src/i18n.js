export const LANGUAGES = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
];

const TEXT = {
  it: {
    explore: 'Esplora', geometry: 'Geometria', data: 'Dati', settings: 'Impostazioni',
    layer: 'Layer', activeLayer: 'Layer attivo', addLayer: 'Aggiungi layer', noLayer: 'Nessun layer',
    createNewLayer: 'Crea nuovo layer', uploadExistingLayer: 'Carica layer esistente',
    crsProject: 'CRS progetto', changeCrs: 'Cambia CRS', lockedMenus: 'Menu bloccati',
    grid: 'Griglia', basemap: 'Mappa base', gps: 'GPS', scale: 'Scala', measure: 'Misura',
    pointInsert: 'Inserimento punti', pointInsertHelp: 'Tocca la mappa per aggiungere punti. Trascina con due dita per spostarti senza creare punti.',
    createLayer: 'Crea layer', uploadLayer: 'Carica layer', backToLayers: '← Torna alla lista layer',
    output: 'destinazione', outputDestination: 'Destinazione esportazione', outputFile: 'File di uscita', outputFolder: 'Cartella di destinazione',
    fullFilePath: 'Percorso completo file', choose: 'Scegli', chooseFolder: 'Scegli cartella', chooseOutputFile: 'Scegli file di output',
    browserDownload: 'Download del browser', useBrowserDownload: 'Usa download del browser', notSelected: 'Non selezionato', defaultValue: 'Valore predefinito', defaultLabel: 'Predefinito',
    fileName: 'Nome file', extension: 'Estensione', export: 'Esporta', exportHelp: 'Scegli nome, estensione, percorso e CRS.',
    allLayers: 'Tutti i layer', feature: 'feature', features: 'feature', geom: 'Geom', dateTime: 'Data/Ora', actions: 'Azioni',
    noFeatures: 'Nessuna feature raccolta', noFeaturesHelp: 'Usa “Geometria” dalla mappa per raccogliere punti, linee o poligoni, oppure importa un file dalla sezione Carica.',
    featureProperties: 'Proprietà feature', coordinates: 'Coordinate', delete: 'Elimina', cancel: 'Annulla', saveChanges: 'Salva modifiche',
    language: 'Lingua', interfaceLanguage: 'Lingua interfaccia', italian: 'Italiano', english: 'English',
    coordinateReference: 'Riferimento coordinate', sensorsSystem: 'Sensori e sistema', help: 'Aiuto', quickGuide: 'Guida rapida', showTutorial: 'Mostra tutorial',
    resetDefaults: 'Ripristina predefiniti', theme: 'Tema', units: 'Unità', metric: 'Metrico', imperial: 'Imperiale', light: 'Chiaro', dark: 'Scuro',
    apply: 'Applica', add: 'Aggiungi', name: 'Nome', type: 'Tipo', fields: 'Campi', fieldName: 'Nome campo', fieldType: 'Tipo campo',
    point: 'Punto', line: 'Linea', polygon: 'Poligono', table: 'Tabella', string: 'Testo', integer: 'Intero', double: 'Decimale', date: 'Data', boolean: 'Booleano',
    selectedFolder: 'Cartella selezionata', selectedFile: 'File selezionato', unknown: 'Sconosciuto', selectedCrs: 'CRS selezionato',
  },
  en: {
    explore: 'Explore', geometry: 'Geometry', data: 'Data', settings: 'Settings',
    layer: 'Layer', activeLayer: 'Active layer', addLayer: 'Add layer', noLayer: 'No layer',
    createNewLayer: 'Create new layer', uploadExistingLayer: 'Load existing layer',
    crsProject: 'Project CRS', changeCrs: 'Change CRS', lockedMenus: 'Menus locked',
    grid: 'Grid', basemap: 'Basemap', gps: 'GPS', scale: 'Scale', measure: 'Measure',
    pointInsert: 'Point insertion', pointInsertHelp: 'Tap the map to add points. Drag with two fingers to pan without creating points.',
    createLayer: 'Create layer', uploadLayer: 'Load layer', backToLayers: '← Back to layer list',
    output: 'Output', outputDestination: 'Output destination', outputFile: 'Output file', outputFolder: 'Output folder',
    fullFilePath: 'Full file path', choose: 'Choose', chooseFolder: 'Choose folder', chooseOutputFile: 'Choose output file',
    browserDownload: 'Browser download', useBrowserDownload: 'Use browser download', notSelected: 'Not selected', defaultValue: 'Default value', defaultLabel: 'Default',
    fileName: 'File name', extension: 'Extension', export: 'Export', exportHelp: 'Choose name, extension, path and CRS.',
    allLayers: 'All layers', feature: 'feature', features: 'features', geom: 'Geom', dateTime: 'Date/Time', actions: 'Actions',
    noFeatures: 'No collected features', noFeaturesHelp: 'Use “Geometry” from the map to collect points, lines or polygons, or import a file from Load.',
    featureProperties: 'Feature properties', coordinates: 'Coordinates', delete: 'Delete', cancel: 'Cancel', saveChanges: 'Save changes',
    language: 'Language', interfaceLanguage: 'Interface language', italian: 'Italiano', english: 'English',
    coordinateReference: 'Coordinate reference', sensorsSystem: 'Sensors and system', help: 'Help', quickGuide: 'Quick guide', showTutorial: 'Show tutorial',
    resetDefaults: 'Reset defaults', theme: 'Theme', units: 'Units', metric: 'Metric', imperial: 'Imperial', light: 'Light', dark: 'Dark',
    apply: 'Apply', add: 'Add', name: 'Name', type: 'Type', fields: 'Fields', fieldName: 'Field name', fieldType: 'Field type',
    point: 'Point', line: 'Line', polygon: 'Polygon', table: 'Table', string: 'String', integer: 'Integer', double: 'Double', date: 'Date', boolean: 'Boolean',
    selectedFolder: 'Selected folder', selectedFile: 'Selected file', unknown: 'Unknown', selectedCrs: 'Selected CRS',
  },
};

export function t(language, key) {
  const lang = language === 'en' ? 'en' : 'it';
  return TEXT[lang]?.[key] || TEXT.it[key] || key;
}

export function fieldTypeLabel(language, type) {
  const map = { String: 'string', Integer: 'integer', Double: 'double', Date: 'date', Boolean: 'boolean' };
  return t(language, map[type] || type);
}
