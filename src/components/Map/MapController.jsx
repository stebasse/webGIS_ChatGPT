import { useEffect, useCallback, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export default function MapController({ gpsPosition, mapRotation, setMapBearing, setGridScaleMeters, setMap, scaleLock, isFreehandMode, onAddNode }) {
  const map = useMap();

  useEffect(() => {
    if (setMap) setMap(map);
  }, [map, setMap]);
  
  const updateScale = useCallback(() => {
    if (setGridScaleMeters) {
      const center = map.getCenter();
      // Calculate how many meters are in 128 pixels horizontally from center
      const centerPoint = map.latLngToContainerPoint(center);
      const testPoint = L.point(centerPoint.x + 128, centerPoint.y);
      const testLatLng = map.containerPointToLatLng(testPoint);
      const distanceFor128px = center.distanceTo(testLatLng);
      
      if (distanceFor128px > 0) {
        setGridScaleMeters(distanceFor128px);
      }
    }
  }, [map, setGridScaleMeters]);

  const isDragging = useRef(false);
  const lastPoint = useRef(null);

  useEffect(() => {
    if (!isFreehandMode || !onAddNode) return;

    const container = map.getContainer();

    const getLatLngFromPointer = (ev) => {
      const point = map.mouseEventToContainerPoint(ev);
      return map.containerPointToLatLng(point);
    };

    const addIfFarEnough = (latlng) => {
      if (!lastPoint.current || lastPoint.current.distanceTo(latlng) >= 0.5) {
        onAddNode(latlng);
        lastPoint.current = latlng;
      }
    };

    const handlePointerDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      container.setPointerCapture?.(ev.pointerId);
      map.dragging.disable();
      map.doubleClickZoom.disable();
      isDragging.current = true;
      const latlng = getLatLngFromPointer(ev);
      onAddNode(latlng);
      lastPoint.current = latlng;
    };

    const handlePointerMove = (ev) => {
      if (!isDragging.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      addIfFarEnough(getLatLngFromPointer(ev));
    };

    const handlePointerUp = (ev) => {
      if (!isDragging.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      isDragging.current = false;
      lastPoint.current = null;
      container.releasePointerCapture?.(ev.pointerId);
      map.dragging.enable();
      map.doubleClickZoom.enable();
    };

    container.style.touchAction = 'none';
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
      container.style.touchAction = '';
      map.dragging.enable();
      map.doubleClickZoom.enable();
      isDragging.current = false;
      lastPoint.current = null;
    };
  }, [map, isFreehandMode, onAddNode]);

  useMapEvents({
    rotate: (e) => {
      if (setMapBearing) setMapBearing(map.getBearing());
    },
    zoomend: updateScale,
    moveend: updateScale
  });

  useEffect(() => {
    updateScale();
  }, [updateScale]);

  useEffect(() => {
    if (gpsPosition) {
      map.flyTo([gpsPosition[1], gpsPosition[0]], 16, { animate: true, duration: 2 });
    }
  }, [gpsPosition, map]);

  useEffect(() => {
    if (map.setBearing && typeof mapRotation === 'number') {
      map.setBearing(mapRotation);
    }
  }, [mapRotation, map]);


  useEffect(() => {
    if (!map) return;
    if (scaleLock?.locked) {
      const lockedZoom = Number.isFinite(scaleLock.zoom) ? scaleLock.zoom : map.getZoom();
      map.scrollWheelZoom.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();

      const keepZoomLocked = () => {
        if (map.getZoom() !== lockedZoom) {
          map.setZoom(lockedZoom, { animate: false });
        }
      };
      map.on('zoomend', keepZoomLocked);
      return () => {
        map.off('zoomend', keepZoomLocked);
        map.scrollWheelZoom.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
      };
    }

    map.scrollWheelZoom.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
  }, [map, scaleLock]);

  return null;
}
