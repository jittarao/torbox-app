'use client';

import { useCallback } from 'react';
import { useHealthStore } from '@/store/healthStore';
import { POLLING_CONFIG } from './pollingConfig';
import { usePresenceAwarePollTimer } from './usePresenceAwarePollTimer';

/**
 * App-global health polling with presence-aware active/background intervals.
 */
export function useHealthPolling(apiKey) {
  const performHealthCheck = useHealthStore((state) => state.performHealthCheck);

  const onTick = useCallback(() => {
    if (!apiKey) return;
    performHealthCheck(apiKey, { force: true });
  }, [apiKey, performHealthCheck]);

  usePresenceAwarePollTimer({
    activeIntervalMs: POLLING_CONFIG.healthActiveIntervalMs,
    backgroundIntervalMs: POLLING_CONFIG.healthBackgroundIntervalMs,
    onTick,
    enabled: Boolean(apiKey),
  });
}
