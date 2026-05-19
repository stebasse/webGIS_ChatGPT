import { createContext, useContext, useMemo, useReducer } from 'react';
import { historyReducer, initialHistoryState } from './historyReducer.js';

const HistoryContext = createContext(null);

export function HistoryProvider({ children }) {
  const [state, dispatch] = useReducer(historyReducer, initialHistoryState);
  const value = useMemo(() => ({
    ...state,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    push: command => dispatch({ type: 'history/push', payload: command }),
    undo: () => dispatch({ type: 'history/undo' }),
    redo: () => dispatch({ type: 'history/redo' }),
    clear: () => dispatch({ type: 'history/clear' }),
  }), [state]);
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistory() {
  const value = useContext(HistoryContext);
  if (!value) throw new Error('useHistory must be used inside HistoryProvider');
  return value;
}
