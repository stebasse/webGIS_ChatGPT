import { useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

export default function MapEvents({ onMapClick, suppressMultiTouchClick = false }) {
  const suppressClickUntil = useRef(0);

  const suppressAfterMultiTouch = (e, ms = 900) => {
    if (!suppressMultiTouchClick) return;
    const original = e.originalEvent;
    const touches = original?.touches;
    const changedTouches = original?.changedTouches;
    if ((touches && touches.length > 1) || (changedTouches && changedTouches.length > 1)) {
      suppressClickUntil.current = Date.now() + ms;
    }
  };

  useMapEvents({
    touchstart(e) {
      suppressAfterMultiTouch(e);
    },
    touchmove(e) {
      suppressAfterMultiTouch(e);
    },
    touchend(e) {
      suppressAfterMultiTouch(e, 1100);
    },
    click(e) {
      if (suppressMultiTouchClick && Date.now() < suppressClickUntil.current) return;
      onMapClick(e);
    }
  });
  return null;
}
