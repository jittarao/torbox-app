/**
 * Global error handler for client-side errors
 * Handles chunk loading failures, service worker errors, and other runtime errors
 */

const CHUNK_RECOVERY_RELOAD_KEY = 'torbox-chunk-recovery-reloads';
const MAX_CHUNK_RECOVERY_RELOADS = 3;

const STALE_CHUNK_INDICATORS = ['_next/static', 'chunk', 'webpack', '__webpack'];

/**
 * True only for deployment/cache mismatch errors — not ordinary app ReferenceErrors
 * (e.g. "collapsed is not defined").
 */
export function isChunkOrStaleCacheError(error) {
  const message = error?.message || String(error || '');
  const name = error?.name || '';
  const stack = error?.stack || '';

  if (
    name === 'ChunkLoadError' ||
    message.includes('ChunkLoadError') ||
    message.includes('Loading chunk') ||
    message.includes('Failed to fetch dynamically imported module')
  ) {
    return true;
  }

  // Legacy artifact from stale service worker / cached bundles
  if (message.includes('returnNaN')) {
    return true;
  }

  // Stale hashed chunks can surface as ReferenceError in _next/static code, not app variables
  if (name === 'ReferenceError' || message.includes('ReferenceError')) {
    const haystack = `${message}\n${stack}`;
    return STALE_CHUNK_INDICATORS.some((indicator) => haystack.includes(indicator));
  }

  return false;
}

function canAttemptChunkRecovery() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return true;
  }

  try {
    const count = Number(sessionStorage.getItem(CHUNK_RECOVERY_RELOAD_KEY) || 0);
    if (count >= MAX_CHUNK_RECOVERY_RELOADS) {
      console.error(
        `Chunk recovery stopped after ${MAX_CHUNK_RECOVERY_RELOADS} reloads in this tab. ` +
          'Fix the underlying error or clear site data before retrying.'
      );
      return false;
    }
    sessionStorage.setItem(CHUNK_RECOVERY_RELOAD_KEY, String(count + 1));
    return true;
  } catch {
    return true;
  }
}

/** Reload with a session cap so recovery cannot loop forever on a real bug. */
export function scheduleChunkRecoveryReload(delayMs = 0) {
  if (!canAttemptChunkRecovery()) {
    return false;
  }

  setTimeout(() => {
    window.location.reload();
  }, delayMs);

  return true;
}

function scheduleReload(delayMs) {
  scheduleChunkRecoveryReload(delayMs);
}

// Handle chunk loading errors (common during deployments)
export function handleChunkError(error, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = 1000 * (retryCount + 1); // Exponential backoff

  if (!isChunkOrStaleCacheError(error) || retryCount >= maxRetries) {
    return false;
  }

  console.warn(
    `Chunk loading error detected (attempt ${retryCount + 1}/${maxRetries}). Retrying...`,
    error
  );

  setTimeout(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update();
        });
      });
    }

    scheduleReload(0);
  }, retryDelay);

  return true;
}

// Handle service worker errors
export function handleServiceWorkerError(error) {
  const message = error?.message || String(error || '');

  if (
    !message.includes('service worker') &&
    !message.includes('ServiceWorker') &&
    !message.includes('returnNaN')
  ) {
    return false;
  }

  console.warn('Service worker error detected. Attempting to unregister and reload...', error);

  if (!('serviceWorker' in navigator)) {
    return false;
  }

  if (!canAttemptChunkRecovery()) {
    return true;
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().then(() => {
        console.log('Service worker unregistered');
        if ('caches' in window) {
          caches
            .keys()
            .then((cacheNames) => {
              return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
            })
            .then(() => {
              console.log('All caches cleared');
              scheduleReload(500);
            });
        } else {
          scheduleReload(500);
        }
      });
    });
  });

  return true;
}

// Global error handler (legacy; prefer ErrorHandlerInitializer)
export function setupGlobalErrorHandler() {
  window.addEventListener('unhandledrejection', (event) => {
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
  });

  window.addEventListener('error', (event) => {
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
  });
}

// Note: Error handler is now initialized via ErrorHandlerInitializer component
// This allows better control over when it's set up in the React component tree
