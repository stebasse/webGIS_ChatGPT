import { useCallback, useEffect, useState } from 'react';

async function requestCompassPermission() {
  if (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

export function useSettingsDraft({ settings, setSettings, activeTab, onSaved }) {
  const [draftSettings, setDraftSettings] = useState(settings);
  const language = settings.language || 'it';

  useEffect(() => {
    const activeTheme = activeTab === 'settings' ? draftSettings.theme : settings.theme;
    document.documentElement.classList.toggle('light-theme', activeTheme === 'light');
  }, [settings.theme, draftSettings.theme, activeTab]);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const saveSettings = useCallback(async () => {
    if (draftSettings.compassMode && !settings.compassMode) {
      const granted = await requestCompassPermission();
      if (!granted) {
        alert(language === 'en'
          ? 'Device orientation permission denied. Compass mode disabled.'
          : 'Permesso orientamento dispositivo negato. Modalità bussola disabilitata.');
        setDraftSettings(s => ({ ...s, compassMode: false }));
        return;
      }
    }
    setSettings(draftSettings);
    onSaved?.();
  }, [draftSettings, language, onSaved, setSettings, settings.compassMode]);

  return { draftSettings, setDraftSettings, language, saveSettings };
}
