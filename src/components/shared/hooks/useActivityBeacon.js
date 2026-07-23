'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useBackendMode } from '@/hooks/useBackendMode';

const BEACON_INTERVAL_MS = 120 * 1000;
const MIN_PING_GAP_MS = 90 * 1000;

/**
 * Periodically POST user activity to the backend when a session API key is present.
 * Aligns with server online window (2 min) while respecting client debounce (90s).
 */
export function useActivityBeacon() {
  const apiKey = useSessionStore((s) => s.apiKey);
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const lastPingAtRef = useRef(0);

  const isActive =
    Boolean(apiKey) &&
    !backendIsLoading &&
    backendMode === 'backend' &&
    typeof document !== 'undefined';

  useEffect(() => {
    if (isActive) {
      const ping = async () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastPingAtRef.current < MIN_PING_GAP_MS) return;

        try {
          const response = await fetch('/api/backend/activity', {
            method: 'POST',
            headers: { 'x-api-key': apiKey },
          });
          if (response.ok) {
            lastPingAtRef.current = now;
          }
        } catch {
          // Non-critical; next interval will retry
        }
      };

      let intervalId = null;

      const startInterval = () => {
        if (intervalId != null) return;
        intervalId = setInterval(() => {
          void ping();
        }, BEACON_INTERVAL_MS);
      };

      const stopInterval = () => {
        if (intervalId != null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          void ping();
          startInterval();
        } else {
          stopInterval();
        }
      };

      if (document.visibilityState === 'visible') {
        void ping();
        startInterval();
      }

      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        stopInterval();
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [apiKey, isActive]);
}
