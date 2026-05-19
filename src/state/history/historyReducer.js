export const initialHistoryState = { past: [], future: [], lastLabel: null };

export function createCommand(label, apply, revert) {
  return { label, apply, revert };
}

export function historyReducer(state, action) {
  switch (action.type) {
    case 'history/push':
      return { past: [...state.past, action.payload], future: [], lastLabel: action.payload?.label || null };
    case 'history/undo': {
      const command = state.past[state.past.length - 1];
      if (!command) return state;
      return { past: state.past.slice(0, -1), future: [command, ...state.future], lastLabel: command.label };
    }
    case 'history/redo': {
      const command = state.future[0];
      if (!command) return state;
      return { past: [...state.past, command], future: state.future.slice(1), lastLabel: command.label };
    }
    case 'history/clear':
      return initialHistoryState;
    default:
      return state;
  }
}
