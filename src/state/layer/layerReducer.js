export const initialLayerState = {
  filter: '',
  visibleLayerIds: [],
  editableLayerId: null,
};

export function layerReducer(state, action) {
  switch (action.type) {
    case 'layer/filter':
      return { ...state, filter: action.payload || '' };
    case 'layer/set-visible':
      return { ...state, visibleLayerIds: action.payload || [] };
    case 'layer/set-editable':
      return { ...state, editableLayerId: action.payload || null };
    default:
      return state;
  }
}
