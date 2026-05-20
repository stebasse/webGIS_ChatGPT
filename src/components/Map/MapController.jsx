import { useEffect, useCallback, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export default function MapController({ gpsPosition, mapRotation, setMapBearing, setGridScaleMeters, setMap, isFreehandMode, onAddNode, scaleLocked }) {
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
  const activePointers = useRef(new Map());
  const twoFingerPan = useRef(false);
  const lastPanCenter = useRef(null);
  const pendingTouchLatLng = useRef(null);

  useEffect(() => {
    if (!isFreehandMode || !onAddNode) return;

    const container = map.getContainer();

    const getLatLngFromPointer = (ev) => {
      const point = map.mouseEventToContainerPoint(ev);
      return map.containerPointToLatLng(point);
    };

    const pointerCenter = () => {
      const points = [...activePointers.current.values()];
      if (points.length < 2) return null;
      return L.point(
        points.reduce((sum, p) => sum + p.x, 0) / points.length,
        points.reduce((sum, p) => sum + p.y, 0) / points.length
      );
    };

    const startTwoFingerPan = () => {
      twoFingerPan.current = true;
      isDragging.current = false;
      lastPoint.current = null;
      pendingTouchLatLng.current = null;
      lastPanCenter.current = pointerCenter();
      map.dragging.disable();
      map.doubleClickZoom.disable();
    };

    const addIfFarEnough = (latlng) => {
      if (!lastPoint.current || lastPoint.current.distanceTo(latlng) >= 0.5) {
        onAddNode(latlng);
        lastPoint.current = latlng;
      }
    };

    const handlePointerDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      activePointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, type: ev.pointerType });

      if (ev.pointerType === 'touch' && activePointers.current.size >= 2) {
        ev.preventDefault();
        ev.stopPropagation();
        startTwoFingerPan();
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();
      container.setPointerCapture?.(ev.pointerId);
      map.dragging.disable();
      map.doubleClickZoom.disable();
      isDragging.current = true;
      const latlng = getLatLngFromPointer(ev);

      if (ev.pointerType === 'touch') {
        // Do not create a vertex immediately on first touch: a second finger may
        // arrive to pan the map. The point is committed only if it remains a
        // true one-finger draw/tap gesture.
        pendingTouchLatLng.current = latlng;
        lastPoint.current = null;
        return;
      }

      onAddNode(latlng);
      lastPoint.current = latlng;
    };

    const handlePointerMove = (ev) => {
      if (!activePointers.current.has(ev.pointerId)) return;
      activePointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, type: ev.pointerType });

      if (twoFingerPan.current) {
        ev.preventDefault();
        ev.stopPropagation();
        const center = pointerCenter();
        if (center && lastPanCenter.current) {
          map.panBy(lastPanCenter.current.subtract(center), { animate: false });
        }
        lastPanCenter.current = center;
        return;
      }

      if (!isDragging.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const latlng = getLatLngFromPointer(ev);
      if (pendingTouchLatLng.current) {
        onAddNode(pendingTouchLatLng.current);
        lastPoint.current = pendingTouchLatLng.current;
        pendingTouchLatLng.current = null;
      }
      addIfFarEnough(latlng);
    };

    const handlePointerUp = (ev) => {
      const wasTracked = activePointers.current.has(ev.pointerId);
      activePointers.current.delete(ev.pointerId);
      container.releasePointerCapture?.(ev.pointerId);

      if (twoFingerPan.current) {
        ev.preventDefault();
        ev.stopPropagation();
        if (activePointers.current.size < 2) {
          twoFingerPan.current = false;
          lastPanCenter.current = null;
          isDragging.current = false;
          lastPoint.current = null;
          map.dragging.enable();
          map.doubleClickZoom.enable();
        }
        return;
      }

      if (!isDragging.current && !wasTracked) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (pendingTouchLatLng.current) {
        onAddNode(pendingTouchLatLng.current);
        pendingTouchLatLng.current = null;
      }
      isDragging.current = false;
      lastPoint.current = null;
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
      activePointers.current.clear();
      twoFingerPan.current = false;
      lastPanCenter.current = null;
      pendingTouchLatLng.current = null;
    };
  }, [map, isFreehandMode, onAddNode]);


  const originalZoomLimits = useRef(null);

  useEffect(() => {
    if (!map) return;

    const controls = [map.scrollWheelZoom, map.doubleClickZoom, map.boxZoom, map.keyboard, map.touchZoom];

    if (scaleLocked) {
      if (!originalZoomLimits.current) {
        originalZoomLimits.current = {
          minZoom: map.getMinZoom?.(),
          maxZoom: map.getMaxZoom?.()
        };
      }

      const lockedZoom = map.getZoom();
      controls.forEach(c => c?.disable?.());
      map.setMinZoom?.(lockedZoom);
      map.setMaxZoom?.(lockedZoom);
    } else {
      const limits = originalZoomLimits.current;
      controls.forEach(c => c?.enable?.());
      if (limits) {
        if (Number.isFinite(limits.minZoom)) map.setMinZoom?.(limits.minZoom);
        if (Number.isFinite(limits.maxZoom)) map.setMaxZoom?.(limits.maxZoom);
      }
      originalZoomLimits.current = null;
    }

    return () => {
      controls.forEach(c => c?.enable?.());
      const limits = originalZoomLimits.current;
      if (limits) {
        if (Number.isFinite(limits.minZoom)) map.setMinZoom?.(limits.minZoom);
        if (Number.isFinite(limits.maxZoom)) map.setMaxZoom?.(limits.maxZoom);
      }
    };
  }, [map, scaleLocked]);

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

  return null;
}
