export const DEFAULT_SETTINGS = {
  theme: 'dark',
  units: 'metric',
  crsOverride: false,
  projectCrs: 'EPSG:4326',
  gpu: true,
  logLevel: 'low',
  compassMode: false,
  language: 'it',
};

export const FIELD_TYPES = ['String', 'Integer', 'Double', 'Date', 'Boolean'];

export const EMPTY_NEW_LAYER = { name: '', type: 'Point' };
export const EMPTY_NEW_FIELD = { name: '', type: 'String' };
