import { useState, useEffect } from 'react';

function sanitizeValue(parsed, initialValue) {
  // Array states must remain arrays. Old/corrupt localStorage values used to
  // crash the app at startup with e.g. layers.find is not a function.
  if (Array.isArray(initialValue)) {
    return Array.isArray(parsed) ? parsed : initialValue;
  }

  // Object states are merged with defaults so new settings added in later
  // versions always exist, while preserving the user's stored values.
  if (
    initialValue &&
    typeof initialValue === 'object' &&
    !Array.isArray(initialValue)
  ) {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...initialValue, ...parsed }
      : initialValue;
  }

  // Primitive states must keep their primitive type when possible.
  if (typeof parsed === typeof initialValue) return parsed;
  return initialValue;
}

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === null || saved === undefined) return initialValue;
      return sanitizeValue(JSON.parse(saved), initialValue);
    } catch (error) {
      console.warn(`Invalid localStorage value for ${key}; resetting to default.`, error);
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Unable to persist ${key}.`, error);
    }
  }, [key, state]);

  return [state, setState];
}
