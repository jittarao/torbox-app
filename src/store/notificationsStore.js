import { create } from 'zustand';
import { createApiClient } from '@/utils/apiClient';
import { fetchNotificationsRequest } from '@/store/notifications/fetchNotifications';
import { shouldSkipNotificationFetch } from '@/store/notifications/notificationFetchUtils';
import {
  clearReadNotifications,
  persistAllReadNotificationIds,
  persistClearedNotificationId,
  persistClearedNotificationIds,
  persistReadNotificationId,
  removeReadNotificationId,
} from '@/store/notifications/notificationStorage';

export { selectUnreadCount } from '@/store/notifications/notificationsSelectors';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  isPolling: true,
  consecutiveErrors: 0,
  lastErrorTime: null,
  rateLimitBackoffUntil: null,
  lastFetchTime: null,
  currentApiKey: null,
  fetchingNotifications: false,
  pollSubscribers: 0,
  pollTimerId: null,

  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        notifications: [],
        error: null,
        consecutiveErrors: 0,
        lastErrorTime: null,
        rateLimitBackoffUntil: null,
        lastFetchTime: null,
      });
    }
  },

  fetchNotifications: async (apiKey, options = {}) => {
    get().setApiKey(apiKey);

    if (get().fetchingNotifications) return;
    if (shouldSkipNotificationFetch(get(), options)) return;

    const now = Date.now();
    set({
      fetchingNotifications: true,
      error: null,
      lastFetchTime: now,
      ...(get().notifications.length === 0 ? { loading: true } : {}),
    });

    const snapshot = get();
    const { patch, aborted } = await fetchNotificationsRequest(apiKey, snapshot, options);

    if (aborted) {
      if (get().fetchingNotifications) {
        set({ fetchingNotifications: false, loading: false });
      }
      return;
    }

    if (patch) {
      set({ ...patch, fetchingNotifications: false });
    } else if (get().fetchingNotifications) {
      set({ fetchingNotifications: false, loading: false });
    }
  },

  clearAllNotifications: async (apiKey) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);
    const { notifications } = get();

    try {
      const response = await apiClient.clearAllNotifications();

      if (response && response.success) {
        try {
          const currentNotificationIds = notifications.map((n) => n.id);
          persistClearedNotificationIds(currentNotificationIds);
        } catch (error) {
          console.error('Error storing cleared notifications:', error);
        }

        set({ notifications: [] });
        clearReadNotifications();

        return {
          success: true,
          message: 'All notifications cleared successfully',
        };
      }

      const errorMsg = response?.error || response?.detail || 'Failed to clear notifications';
      throw new Error(errorMsg);
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return { success: false, error: error.message };
    }
  },

  clearNotification: async (apiKey, notificationId) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);

    try {
      const response = await apiClient.clearNotification(notificationId);

      if (response && response.success) {
        try {
          persistClearedNotificationId(notificationId);
        } catch (error) {
          console.error('Error storing cleared notification:', error);
        }

        const { notifications } = get();
        set({
          notifications: notifications.filter((n) => n.id !== notificationId),
        });

        try {
          removeReadNotificationId(notificationId);
        } catch (error) {
          console.error('Error updating read status:', error);
        }

        return {
          success: true,
          message: 'Notification cleared successfully',
        };
      }

      const errorMsg = response?.error || response?.detail || 'Failed to clear notification';
      throw new Error(errorMsg);
    } catch (error) {
      console.error('Error clearing notification:', error);
      return { success: false, error: error.message };
    }
  },

  testNotification: async (apiKey) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);

    try {
      const response = await apiClient.testNotification();

      if (response.success) {
        return { success: true, message: 'Test notification sent successfully' };
      }
      throw new Error(response.error || 'Failed to send test notification');
    } catch (error) {
      console.error('Error testing notification:', error);
      return { success: false, error: error.message };
    }
  },

  markAsRead: (notificationId) => {
    const { notifications } = get();
    set({
      notifications: notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      ),
    });

    try {
      persistReadNotificationId(notificationId);
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  },

  markAllAsRead: () => {
    const { notifications } = get();
    set({
      notifications: notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    });

    try {
      persistAllReadNotificationIds(notifications.map((n) => n.id));
    } catch (error) {
      console.error('Error saving read status:', error);
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));
  },

  removeNotification: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
    }));
  },

  setIsPolling: (isPolling) => {
    set({ isPolling });
  },

  retryFetch: (apiKey) => {
    set({
      consecutiveErrors: 0,
      lastErrorTime: null,
      rateLimitBackoffUntil: null,
      error: null,
      isPolling: true,
    });
    get().fetchNotifications(apiKey, { force: true });
  },
}));
