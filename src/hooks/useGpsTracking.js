import { useCallback, useEffect, useRef, useState } from 'react';

const GPS_ERROR_MESSAGES = {
  1: 'Permesso negato. Abilita la localizzazione nelle impostazioni del browser per questo sito.',
  2: 'Posizione non disponibile. Assicurati di avere il GPS attivo sul dispositivo.',
  3: 'Timeout. Il GPS non ha risposto in tempo. Riprova.',
};

function isGpsAllowedInCurrentContext() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return window.isSecureContext || isLocal;
}

function buildInsecureContextMessage() {
  return (
    'GPS BLOCCATO (CONTESTO NON SICURO)\n\n' +
    `Il browser impedisce l'uso del GPS su connessioni HTTP non criptate (come l'accesso via IP locale: ${window.location.hostname}).\n\n` +
    "Per attivare il GPS su questo dispositivo:\n" +
    '1. Usa un tunnel HTTPS (es. ngrok o certificati locali).\n' +
    "2. Accedi all'app tramite 'localhost' (se sei sul PC che esegue il server).\n" +
    '3. (Solo Chrome/Edge) Abilita l’indirizzo nelle impostazioni avanzate: chrome://flags/#unsafely-treat-insecure-origin-as-secure aggiungendo questo URL.'
  );
}

export function useGpsTracking() {
  const gpsWatchRef = useRef(null);
  const [gpsState, setGpsState] = useState({ position: null, accuracy: null, tracking: false });

  const stopTracking = useCallback(() => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setGpsState(prev => ({ ...prev, tracking: false }));
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation non è supportata da questo browser.');
      return;
    }

    if (gpsState.tracking && gpsWatchRef.current !== null) {
      stopTracking();
      return;
    }

    if (!isGpsAllowedInCurrentContext()) {
      alert(buildInsecureContextMessage());
      return;
    }

    setGpsState(prev => ({ ...prev, tracking: true }));
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState({
          position: [pos.coords.longitude, pos.coords.latitude],
          accuracy: pos.coords.accuracy,
          tracking: true,
        });
      },
      (error) => {
        alert(`Errore GPS: ${GPS_ERROR_MESSAGES[error.code] || error.message}`);
        setGpsState(prev => ({ ...prev, tracking: false }));
        gpsWatchRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [gpsState.tracking, stopTracking]);

  return { gpsState, locateMe };
}
