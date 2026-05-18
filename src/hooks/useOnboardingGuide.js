import { useCallback, useState } from 'react';

const ONBOARDING_KEY = 'webgis_onboarding_completed';

export function useOnboardingGuide({ onReplay } = {}) {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // localStorage may be unavailable in private mode; still close the guide for this session.
    }
    setShowOnboarding(false);
  }, []);

  const showTutorialAgain = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
    } catch {
      // Ignore storage errors and reopen in the current session.
    }
    setShowOnboarding(true);
    onReplay?.();
  }, [onReplay]);

  return { showOnboarding, finishOnboarding, showTutorialAgain };
}
