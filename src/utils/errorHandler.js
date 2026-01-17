/**
 * Global error handler for client-side errors
 * Handles chunk loading failures, service worker errors, and other runtime errors
 */

// Handle chunk loading errors (common during deployments)
export function handleChunkError(error, retryCount = 0) {
  const maxRetries = 3;
  const retryDelay = 1000 * (retryCount + 1); // Exponential backoff

  // Check if it's a chunk loading error
  const isChunkError =
    error?.message?.includes('ChunkLoadError') ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('returnNaN') || // Handle the specific error
    error?.name === 'ChunkLoadError';

  if (isChunkError && retryCount < maxRetries) {
    console.warn(`Chunk loading error detected (attempt ${retryCount + 1}/${maxRetries}). Retrying...`, error);
    
    // Wait and reload the page to get fresh chunks
    setTimeout(() => {
      // Clear service worker cache if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.update(); // Force service worker update
          });
        });
      }
      
      // Reload the page to get fresh chunks
      window.location.reload();
    }, retryDelay);
    
    return true; // Error handled
  }

  return false; // Error not handled
}

// Handle service worker errors
export function handleServiceWorkerError(error) {
  if (
    error?.message?.includes('service worker') ||
    error?.message?.includes('ServiceWorker') ||
    error?.message?.includes('returnNaN') // Could be from cached SW
  ) {
    console.warn('Service worker error detected. Attempting to unregister and reload...', error);
    
    // Unregister all service workers and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then(() => {
            console.log('Service worker unregistered');
            // Clear all caches
            if ('caches' in window) {
              caches.keys().then((cacheNames) => {
                return Promise.all(
                  cacheNames.map((cacheName) => caches.delete(cacheName))
                );
              }).then(() => {
                console.log('All caches cleared');
                // Reload after a short delay
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              });
            } else {
              window.location.reload();
            }
          });
        });
      });
    }
    
    return true; // Error handled
  }

  return false; // Error not handled
}

// Global error handler
export function setupGlobalErrorHandler() {
  // Handle unhandled promise rejections (common with chunk loading)
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    
    // Try to handle chunk errors
    if (handleChunkError(error)) {
      event.preventDefault(); // Prevent default error logging
      return;
    }
    
    // Try to handle service worker errors
    if (handleServiceWorkerError(error)) {
      event.preventDefault();
      return;
    }
    
    // Log other unhandled rejections
    console.error('Unhandled promise rejection:', error);
  });

  // Handle general errors
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    
    // Check for the specific returnNaN error
    if (
      error?.message?.includes('returnNaN') ||
      error?.message?.includes('is not defined') ||
      error?.message?.includes('ReferenceError')
    ) {
      console.warn('Reference error detected (possibly from cached code). Attempting recovery...', error);
      
      // Try chunk error handling first
      if (handleChunkError(error)) {
        event.preventDefault();
        return;
      }
      
      // Try service worker error handling
      if (handleServiceWorkerError(error)) {
        event.preventDefault();
        return;
      }
    }
  });
}

// Note: Error handler is now initialized via ErrorHandlerInitializer component
// This allows better control over when it's set up in the React component tree
