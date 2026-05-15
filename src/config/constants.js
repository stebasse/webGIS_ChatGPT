export const LAYERS = [];

export const colorMap = {
  'bg-primary': '#0ea5e9',
  'bg-secondary': '#8b5cf6',
  'bg-tertiary': '#f59e0b',
  'bg-blue-400': '#60a5fa',
  'bg-emerald-500': '#10b981',
  'bg-indigo-500': '#6366f1'
};

export const BASEMAPS = {
  carto_dark: { name: 'Dark Matter', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '&copy; CARTO' },
  osm: { name: 'OSM Standard', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap contributors' },
  satellite: { name: 'Satellite (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '&copy; Esri' }
};
