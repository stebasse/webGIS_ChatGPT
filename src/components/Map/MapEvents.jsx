import { useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

export default function MapEvents({ onMapClick, suppressMultiTouchClick = false }) {
  const suppressClickUntil = useRef(0);

  useMapEvents({
    touchstart(e) {
      if (!suppressMultiTouchClick) return;
      const touches = e.originalEvent?.touches;
      if (touches && touches.length > 1) {
        suppressClickUntil.current = Date.now() + 700;
      }
    },
    touchmove(e) {
      if (!suppressMultiTouchClick) return;
      const touches = e.originalEvent?.touches;
      if (touches && touches.length > 1) {
        suppressClickUntil.current = Date.now() + 700;
      }
    },
    click(e) {
      if (suppressMultiTouchClick && Date.now() < suppressClickUntil.current) return;
      onMapClick(e);
    }
  });
  return null;
}
