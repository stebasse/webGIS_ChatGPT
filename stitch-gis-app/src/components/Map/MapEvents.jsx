import { useMapEvents } from 'react-leaflet';

export default function MapEvents({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e);
    }
  });
  return null;
}
