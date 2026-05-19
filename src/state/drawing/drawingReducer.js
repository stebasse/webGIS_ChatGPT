export const initialDrawingState = {
  drawingMode: false,
  draftCoordinates: [],
  isFreehandMode: false,
  pointTapMode: false,
  measureMode: false,
  measureCoordinates: [],
  selection: {
    selectedFeatureIds: [],
    editingFeatureId: null,
    activeVertexIndex: null,
  },
  snapping: {
    enabled: false,
    tolerancePx: 12,
    candidate: null,
  },
};

export function drawingReducer(state, action) {
  switch (action.type) {
    case 'drawing/set-mode':
      return { ...state, drawingMode: action.payload };
    case 'drawing/set-draft':
      return { ...state, draftCoordinates: action.payload };
    case 'drawing/add-draft-coordinate':
      return { ...state, draftCoordinates: [...state.draftCoordinates, action.payload] };
    case 'drawing/undo-draft-coordinate':
      return { ...state, draftCoordinates: state.draftCoordinates.slice(0, -1) };
    case 'drawing/clear-draft':
      return { ...state, drawingMode: false, isFreehandMode: false, draftCoordinates: [] };
    case 'drawing/set-freehand':
      return { ...state, isFreehandMode: action.payload };
    case 'drawing/set-point-tap':
      return { ...state, pointTapMode: action.payload };
    case 'measurement/set-mode':
      return { ...state, measureMode: action.payload, measureCoordinates: action.payload ? state.measureCoordinates : [] };
    case 'measurement/toggle': {
      const next = state.measureMode === 'Distance' ? 'Area' : state.measureMode === 'Area' ? false : 'Distance';
      return { ...state, drawingMode: false, isFreehandMode: false, draftCoordinates: [], measureMode: next, measureCoordinates: [] };
    }
    case 'measurement/add-coordinate':
      return { ...state, measureCoordinates: [...state.measureCoordinates, action.payload] };
    case 'measurement/replace-coordinates':
      return { ...state, measureCoordinates: action.payload || [] };
    case 'measurement/clear':
      return { ...state, measureMode: false, measureCoordinates: [] };
    case 'drawing/select-feature':
      return { ...state, selection: { ...state.selection, selectedFeatureIds: action.payload || [] } };
    case 'drawing/start-edit':
      return { ...state, selection: { ...state.selection, editingFeatureId: action.payload, activeVertexIndex: null } };
    case 'drawing/stop-edit':
      return { ...state, selection: { ...state.selection, editingFeatureId: null, activeVertexIndex: null } };
    case 'snapping/set-candidate':
      return { ...state, snapping: { ...state.snapping, candidate: action.payload } };
    case 'snapping/set-enabled':
      return { ...state, snapping: { ...state.snapping, enabled: action.payload } };
    case 'drawing/reset':
      return initialDrawingState;
    default:
      return state;
  }
}
