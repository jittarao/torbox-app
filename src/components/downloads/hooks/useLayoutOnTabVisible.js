'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs when the tab becomes visible again (visibilitychange / bfcache pageshow).
 * Browsers often skip resize and layout updates while backgrounded; virtualized
 * lists and sticky chrome need a fresh measure when the user returns.
 */
export function useLayoutOnTabVisible(callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const run = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => callbackRef.current());
      });
    };

    document.addEventListener('visibilitychange', run);
    window.addEventListener('pageshow', run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('pageshow', run);
    };
  }, []);
}
