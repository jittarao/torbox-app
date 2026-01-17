'use client';

import NextError from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Check if this is a chunk loading or service worker error
    const isChunkError =
      error?.message?.includes('ChunkLoadError') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('returnNaN') ||
      error?.message?.includes('is not defined') ||
      error?.name === 'ChunkLoadError';

    // If it's a chunk/service worker error, attempt recovery
    if (isChunkError && typeof window !== 'undefined') {
      console.warn('Chunk loading error detected in global error boundary. Attempting recovery...', error);
      
      // Clear service worker cache and reload
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }
      
      // Clear caches
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        });
      }
      
      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
      return; // Don't log to Sentry for recoverable errors
    }

    // Only capture exception if Sentry is enabled
    if (process.env.SENTRY_ENABLED === 'true' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true') {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error);
      });
    }
  }, [error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
