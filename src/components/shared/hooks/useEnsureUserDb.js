'use client';

import { useEffect, useRef } from 'react';
import { ensureUserDb } from '@/utils/ensureUserDb';

/**
 * Ensures the per-user backend DB exists when a valid API key is present.
 * Dedupes concurrent calls via ensureUserDb (shared in-flight map).
 */
export function useEnsureUserDb(apiKey) {
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!apiKey || apiKey.length < 20) {
      lastKeyRef.current = '';
      return;
    }

    if (lastKeyRef.current === apiKey) {
      return;
    }
    lastKeyRef.current = apiKey;

    let cancelled = false;

    ensureUserDb(apiKey)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.wasCreated) {
          console.log('User database created for API key');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error ensuring user database:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);
}
