'use client';

import { useEffect } from 'react';
import {
  handleChunkError,
  handleServiceWorkerError,
  isChunkOrStaleCacheError,
} from '@/utils/errorHandler';

/**
 * Client component that initializes global error handling
 * This handles chunk loading errors and service worker issues during deployments
 */
export function ErrorHandlerInitializer() {
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const error = event.reason;

      if (handleChunkError(error)) {
        event.preventDefault();
        return;
      }

      if (handleServiceWorkerError(error)) {
        event.preventDefault();
        return;
      }

      console.error('Unhandled promise rejection:', error);
    };

    const handleError = (event) => {
      const error = event.error || new Error(event.message);

      if (!isChunkOrStaleCacheError(error)) {
        return;
      }

      console.warn('Stale chunk/cache error detected. Attempting recovery...', error);

      if (handleChunkError(error)) {
        event.preventDefault();
        return;
      }

      if (handleServiceWorkerError(error)) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
