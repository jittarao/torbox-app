'use client';

import { useCallback, useEffect } from 'react';
import { useNotificationsStore } from '@/store/notificationsStore';
import { POLLING_CONFIG } from './pollingConfig';
import { usePresenceAwarePollTimer } from './usePresenceAwarePollTimer';

/**
 * Starts global notification polling when a valid API key is present.
 * Mount once at app shell level so polling works on all routes.
 */
export function useNotificationsPolling(apiKey) {
  const fetchNotifications = useNotificationsStore((state) => state.fetchNotifications);

  useEffect(() => {
    if (apiKey) {
      useNotificationsStore.getState().setApiKey(apiKey);
    }
  }, [apiKey]);

  const onTick = useCallback(() => {
    if (!apiKey) return;
    const { isPolling } = useNotificationsStore.getState();
    if (isPolling) {
      fetchNotifications(apiKey);
    }
  }, [apiKey, fetchNotifications]);

  usePresenceAwarePollTimer({
    activeIntervalMs: POLLING_CONFIG.notificationsActiveIntervalMs,
    backgroundIntervalMs: POLLING_CONFIG.notificationsBackgroundIntervalMs,
    onTick,
    enabled: Boolean(apiKey),
  });
}
