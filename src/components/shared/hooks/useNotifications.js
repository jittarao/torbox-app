'use client';

import { useEffect, useCallback } from 'react';
import { useNotificationsStore } from '@/store/notificationsStore';

export function useNotifications(apiKey) {
  const {
    notifications,
    loading,
    error,
    unreadCount,
    isPolling,
    consecutiveErrors,
    fetchNotifications: fetchNotificationsStore,
    clearAllNotifications: clearAllNotificationsStore,
    clearNotification: clearNotificationStore,
    testNotification: testNotificationStore,
    markAsRead: markAsReadStore,
    markAllAsRead: markAllAsReadStore,
    addNotification: addNotificationStore,
    removeNotification: removeNotificationStore,
    setIsPolling: setIsPollingStore,
    retryFetch: retryFetchStore,
    setApiKey,
  } = useNotificationsStore();

  // Update API key in store when it changes (this will reset notifications if changed)
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Wrapper functions that pass apiKey to store actions
  const fetchNotifications = useCallback(async () => {
    if (apiKey) {
      await fetchNotificationsStore(apiKey);
    }
  }, [apiKey, fetchNotificationsStore]);

  const clearAllNotifications = useCallback(async () => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }
    return await clearAllNotificationsStore(apiKey);
  }, [apiKey, clearAllNotificationsStore]);

  const clearNotification = useCallback(
    async (notificationId) => {
      if (!apiKey) {
        return { success: false, error: 'No API key provided' };
      }
      return await clearNotificationStore(apiKey, notificationId);
    },
    [apiKey, clearNotificationStore],
  );

  const testNotification = useCallback(async () => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }
    return await testNotificationStore(apiKey);
  }, [apiKey, testNotificationStore]);

  const retryFetch = useCallback(() => {
    if (apiKey) {
      retryFetchStore(apiKey);
    }
  }, [apiKey, retryFetchStore]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    clearAllNotifications,
    clearNotification,
    testNotification,
    markAsRead: markAsReadStore,
    markAllAsRead: markAllAsReadStore,
    addNotification: addNotificationStore,
    removeNotification: removeNotificationStore,
    setIsPolling: setIsPollingStore,
    retryFetch,
    consecutiveErrors,
  };
}
