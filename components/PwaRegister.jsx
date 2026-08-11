'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // PWA registration is optional; never block the application.
      }
    };

    register();
  }, []);

  return null;
}
