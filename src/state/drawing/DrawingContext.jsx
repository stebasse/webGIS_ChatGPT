import { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { drawingReducer, initialDrawingState } from './drawingReducer.js';

const DrawingStateContext = createContext(null);
const DrawingDispatchContext = createContext(null);
const DrawingLegacyContext = createContext(null);

function createSetter(dispatch, type) {
  return updater => dispatch({ type, payload: updater });
}

export function DrawingProvider({ children }) {
  const [state, dispatch] = useReducer(drawingReducer, initialDrawingState);

  const setDrawingMode = useCallback(createSetter(dispatch, 'drawing/set-mode'), [dispatch]);
  const setDraftCoordinates = useCallback(createSetter(dispatch, 'drawing/set-draft'), [dispatch]);
  const setIsFreehandMode = useCallback(createSetter(dispatch, 'drawing/set-freehand'), [dispatch]);
  const setPointTapMode = useCallback(createSetter(dispatch, 'drawing/set-point-tap'), [dispatch]);
  const setMeasureMode = useCallback(createSetter(dispatch, 'measurement/set-mode'), [dispatch]);
  const setMeasureCoordinates = useCallback(createSetter(dispatch, 'measurement/replace-coordinates'), [dispatch]);

  const legacyApi = useMemo(() => ({
    drawingMode: state.drawingMode,
    setDrawingMode,
    draftCoordinates: state.draftCoordinates,
    setDraftCoordinates,
    isFreehandMode: state.isFreehandMode,
    setIsFreehandMode,
    pointTapMode: state.pointTapMode,
    setPointTapMode,
    measureMode: state.measureMode,
    setMeasureMode,
    measureCoordinates: state.measureCoordinates,
    setMeasureCoordinates,
    selection: state.selection,
    snapping: state.snapping,
  }), [state, setDrawingMode, setDraftCoordinates, setIsFreehandMode, setPointTapMode, setMeasureMode, setMeasureCoordinates]);

  return (
    <DrawingStateContext.Provider value={state}>
      <DrawingDispatchContext.Provider value={dispatch}>
        <DrawingLegacyContext.Provider value={legacyApi}>{children}</DrawingLegacyContext.Provider>
      </DrawingDispatchContext.Provider>
    </DrawingStateContext.Provider>
  );
}

export function useDrawingState() {
  const value = useContext(DrawingStateContext);
  if (!value) throw new Error('useDrawingState must be used inside DrawingProvider');
  return value;
}

export function useDrawingDispatch() {
  const value = useContext(DrawingDispatchContext);
  if (!value) throw new Error('useDrawingDispatch must be used inside DrawingProvider');
  return value;
}

export function useDrawingLegacyState() {
  const value = useContext(DrawingLegacyContext);
  if (!value) throw new Error('useDrawingLegacyState must be used inside DrawingProvider');
  return value;
}
