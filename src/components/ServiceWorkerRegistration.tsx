'use client';
import { useEffect } from 'react';

/** Registriert den Service Worker einmalig beim App-Start. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => { /* SW-Fehler sind nicht kritisch */ });
    }
  }, []);

  return null;
}
