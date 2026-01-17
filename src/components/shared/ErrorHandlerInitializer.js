'use client';

import { useEffect } from 'react';
import { handleChunkError, handleServiceWorkerError } from '@/utils/errorHandler';

/**
 * Client component that initializes global error handling
 * This handles chunk loading errors and service worker issues during deployments
 */
export function ErrorHandlerInitializer() {
  useEffect(() => {
    // Handle unhandled promise rejections (common with chunk loading)
    const handleUnhandledRejection = (event) => {
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
    };

    // Handle general errors
    const handleError = (event) => {
      const error = event.error || new Error(event.message);
      
      // Check for the specific returnNaN error or other reference errors
      if (
        error?.message?.includes('returnNaN') ||
        error?.message?.includes('is not defined') ||
        (error?.message?.includes('ReferenceError') && 
         (error?.message?.includes('_next') || error?.message?.includes('chunk')))
      ) {
        console.warn('Reference error detected (possibly from cached code during deployment). Attempting recovery...', error);
        
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
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null; // This component doesn't render anything
}
