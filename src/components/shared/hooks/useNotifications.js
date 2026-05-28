'use client';

import { useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNotificationsStore } from '@/store/notificationsStore';

export function useNotifications(apiKey) {
  const {
    notifications,
    loading,
    error,
    unreadCount,
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
  } = useNotificationsStore(
    useShallow((s) => ({
      notifications: s.notifications,
      loading: s.loading,
      error: s.error,
      unreadCount: s.unreadCount,
      consecutiveErrors: s.consecutiveErrors,
      fetchNotifications: s.fetchNotifications,
      clearAllNotifications: s.clearAllNotifications,
      clearNotification: s.clearNotification,
      testNotification: s.testNotification,
      markAsRead: s.markAsRead,
      markAllAsRead: s.markAllAsRead,
      addNotification: s.addNotification,
      removeNotification: s.removeNotification,
      setIsPolling: s.setIsPolling,
      retryFetch: s.retryFetch,
      setApiKey: s.setApiKey,
    }))
  );

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

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
    [apiKey, clearNotificationStore]
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
