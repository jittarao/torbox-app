'use client';

import NextError from 'next/error';
import { useEffect, useRef } from 'react';
import { isChunkOrStaleCacheError, scheduleChunkRecoveryReload } from '@/utils/errorHandler';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const recoveryAttempted = useRef(false);

  useEffect(() => {
    if (
      recoveryAttempted.current ||
      typeof window === 'undefined' ||
      !isChunkOrStaleCacheError(error)
    ) {
      if (
        process.env.SENTRY_ENABLED === 'true' ||
        process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true'
      ) {
        import('@sentry/nextjs').then((Sentry) => {
          Sentry.captureException(error);
        });
      }
      return;
    }

    recoveryAttempted.current = true;

    console.warn(
      'Chunk loading error detected in global error boundary. Attempting recovery...',
      error
    );

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }

    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      });
    }

    const reloadTimer = setTimeout(() => {
      scheduleChunkRecoveryReload(0);
    }, 1000);

    return () => clearTimeout(reloadTimer);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
