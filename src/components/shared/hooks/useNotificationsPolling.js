'use client';

import { useEffect } from 'react';
import { useNotificationsStore } from '@/store/notificationsStore';
import { usePollingPauseStore, selectIsPaused } from '@/store/pollingPauseStore';
import { NOTIFICATION_POLL_INTERVAL_MS } from '@/store/notifications/notificationFetchUtils';

/**
 * Starts global notification polling when a valid API key is present.
 * Mount once at app shell level so polling works on all routes.
 */
export function useNotificationsPolling(apiKey) {
  useEffect(() => {
    if (!apiKey) return;

    const store = useNotificationsStore.getState();
    store.setApiKey(apiKey);

    const { pollSubscribers, pollTimerId } = store;
    useNotificationsStore.setState({ pollSubscribers: pollSubscribers + 1 });

    let timerId = pollTimerId;
    if (!timerId) {
      timerId = setInterval(() => {
        const state = useNotificationsStore.getState();
        if (!state.currentApiKey) return;
        if (selectIsPaused(usePollingPauseStore.getState())) return;
        if (state.isPolling) {
          state.fetchNotifications(state.currentApiKey);
        }
      }, NOTIFICATION_POLL_INTERVAL_MS);
      useNotificationsStore.setState({ pollTimerId: timerId });
    }

    store.fetchNotifications(apiKey);

    return () => {
      const { pollSubscribers: subs, pollTimerId: activeTimer } =
        useNotificationsStore.getState();
      const next = Math.max(0, subs - 1);
      useNotificationsStore.setState({ pollSubscribers: next });
      if (next === 0 && activeTimer) {
        clearInterval(activeTimer);
        useNotificationsStore.setState({ pollTimerId: null });
      }
    };
  }, [apiKey]);
}
