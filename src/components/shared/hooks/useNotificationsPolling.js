'use client';

import { useEffect } from 'react';
import { useNotificationsStore } from '@/store/notificationsStore';

/**
 * Starts global notification polling when a valid API key is present.
 * Mount once at app shell level so polling works on all routes.
 */
export function useNotificationsPolling(apiKey) {
  useEffect(() => {
    if (!apiKey) return;

    const { startPolling, stopPolling } = useNotificationsStore.getState();
    startPolling(apiKey);

    return () => {
      stopPolling();
    };
  }, [apiKey]);
}
