import { createContext, useContext, useReducer } from 'react';
import { initialLayerState, layerReducer } from './layerReducer.js';

const LayerStateContext = createContext(null);
const LayerDispatchContext = createContext(null);

export function LayerProvider({ children }) {
  const [state, dispatch] = useReducer(layerReducer, initialLayerState);
  return <LayerStateContext.Provider value={state}><LayerDispatchContext.Provider value={dispatch}>{children}</LayerDispatchContext.Provider></LayerStateContext.Provider>;
}

export function useLayerState() {
  const value = useContext(LayerStateContext);
  if (!value) throw new Error('useLayerState must be used inside LayerProvider');
  return value;
}

export function useLayerDispatch() {
  const value = useContext(LayerDispatchContext);
  if (!value) throw new Error('useLayerDispatch must be used inside LayerProvider');
  return value;
}
