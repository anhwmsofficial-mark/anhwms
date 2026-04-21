'use client';

import { useEffect } from 'react';

function shouldUseServiceWorker(hostname: string) {
  return hostname === 'www.anhwms.com' || hostname === 'anhwms.com' || hostname === 'localhost';
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const run = async () => {
      const hostname = window.location.hostname;
      const serviceWorkerUrl = '/sw.js?v=3';

      if (!shouldUseServiceWorker(hostname)) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
        await registration.update();
        console.log('Service Worker registration successful with scope: ', registration.scope);
      } catch (err) {
        console.log('Service Worker registration failed: ', err);
      }
    };

    window.addEventListener('load', run);
    return () => {
      window.removeEventListener('load', run);
    };
  }, []);

  return null;
}
