import { useState, useEffect } from 'react';

function mergeDefaults(defaultValue, parsedValue) {
  if (
    defaultValue &&
    parsedValue &&
    typeof defaultValue === 'object' &&
    typeof parsedValue === 'object' &&
    !Array.isArray(defaultValue) &&
    !Array.isArray(parsedValue)
  ) {
    return { ...defaultValue, ...parsedValue };
  }
  return parsedValue;
}

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return initialValue;
      return mergeDefaults(initialValue, JSON.parse(saved));
    } catch (err) {
      console.warn(`Invalid localStorage value for ${key}; resetting it.`, err);
      try { localStorage.removeItem(key); } catch {}
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.warn(`Unable to persist ${key}.`, err);
    }
  }, [key, state]);

  return [state, setState];
}
