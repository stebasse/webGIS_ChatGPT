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
    return {
      ...defaultValue,
      ...parsedValue,
    };
  }

  return parsedValue ?? defaultValue;
}

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return initialValue;

      const parsed = JSON.parse(saved);
      return mergeDefaults(initialValue, parsed);
    } catch (error) {
      console.warn(`Invalid localStorage value for ${key}. Resetting it.`, error);
      try {
        localStorage.removeItem(key);
      } catch {}
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Unable to persist ${key} to localStorage.`, error);
    }
  }, [key, state]);

  return [state, setState];
}
