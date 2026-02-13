import { create } from 'zustand';
import { createApiClient } from '@/utils/apiClient';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';

export const useNotificationsStore = create((set, get) => ({
  notifications: [],
  loading: false,
  error: null,
  unreadCount: 0,
  isPolling: true,
  consecutiveErrors: 0,
  lastErrorTime: null,
  currentApiKey: null,
  fetchingNotifications: false,

  // Reset notifications when API key changes
  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        notifications: [],
        unreadCount: 0,
        error: null,
        consecutiveErrors: 0,
        lastErrorTime: null,
      });
    }
  },

  // Fetch notifications from API
  fetchNotifications: async (apiKey) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }
    // Never send invalid key to API (e.g. draft/partial input)
    if (!isValidTorboxApiKey(apiKey)) {
      set({ fetchingNotifications: false, loading: false });
      return;
    }

    const { currentApiKey, fetchingNotifications, consecutiveErrors, lastErrorTime } = get();

    // Update API key in store (this will reset notifications if changed)
    get().setApiKey(apiKey);

    // Prevent duplicate concurrent calls: if already fetching, skip
    if (fetchingNotifications) {
      return;
    }

    // Check if we should skip this request due to recent errors
    const now = Date.now();
    const timeSinceLastError = lastErrorTime ? now - lastErrorTime : Infinity;
    const backoffTime = Math.min(30000 * Math.pow(2, consecutiveErrors), 300000); // Max 5 minutes

    if (consecutiveErrors >= 3 && timeSinceLastError < backoffTime) {
      console.log(`Skipping notification fetch due to consecutive errors. Backoff: ${backoffTime}ms`);
      return;
    }

    const { notifications } = get();
    // Don't show loading state if we already have notifications
    if (notifications.length === 0) {
      set({ loading: true });
    }
    set({ fetchingNotifications: true, error: null });

    const apiClient = createApiClient(apiKey);

    try {
      const response = await apiClient.getNotifications();

      if (response.success) {
        // Reset error state on successful fetch
        set({ consecutiveErrors: 0, lastErrorTime: null });

        // Handle different response formats from TorBox API
        let notificationData = [];

        if (response.data) {
          if (Array.isArray(response.data)) {
            notificationData = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            // Nested data structure
            notificationData = response.data.data;
          } else if (typeof response.data === 'object') {
            // Single notification object
            notificationData = [response.data];
          }
        } else if (Array.isArray(response)) {
          // Direct array response
          notificationData = response;
        }

        // Filter out notifications that have been cleared locally (due to TorBox API bug)
        let clearedNotifications = [];
        try {
          clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
        } catch (error) {
          console.error('Error reading cleared notifications from localStorage:', error);
        }

        const filteredNotifications = notificationData.filter(
          (notification) => !clearedNotifications.includes(notification.id),
        );

        // Get read notifications from localStorage
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        } catch (error) {
          console.error('Error reading read status from localStorage:', error);
        }

        // Apply read status from localStorage
        const notificationsWithReadStatus = filteredNotifications.map((notification) => ({
          ...notification,
          read: notification.read || readNotifications.includes(notification.id),
        }));

        const unread = notificationsWithReadStatus.filter((notification) => !notification.read).length;

        set({
          notifications: notificationsWithReadStatus,
          unreadCount: unread,
          loading: false,
          fetchingNotifications: false,
        });
      } else {
        const errorMsg = response.error || 'Failed to fetch notifications';
        const now = Date.now();
        set({
          error: errorMsg,
          consecutiveErrors: consecutiveErrors + 1,
          lastErrorTime: now,
          loading: false,
          fetchingNotifications: false,
        });
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      const now = Date.now();

      // Check if it's a connection timeout or network error
      const isConnectionError =
        error.isTimeout ||
        error.message?.includes('timeout') ||
        error.message?.includes('Connect Timeout Error') ||
        error.message?.includes('Request timeout') ||
        error.message?.includes('Connection timeout') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('NetworkError') ||
        error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';

      if (isConnectionError) {
        const newConsecutiveErrors = consecutiveErrors + 1;
        set({
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: now,
          error: 'Connection timeout - notifications temporarily unavailable',
          loading: false,
          fetchingNotifications: false,
        });

        // Stop polling after 3 consecutive connection errors
        if (newConsecutiveErrors >= 3) {
          set({ isPolling: false });
          console.log('Stopping notification polling due to consecutive connection errors');
        }
      } else {
        // Only set error for non-connection errors
        set({
          error: error.message,
          loading: false,
          fetchingNotifications: false,
        });
      }
    }
  },

  // Clear all notifications
  clearAllNotifications: async (apiKey) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);
    const { notifications } = get();

    try {
      const response = await apiClient.clearAllNotifications();

      if (response && response.success) {
        // Store all current notification IDs as cleared to prevent them from showing up again
        try {
          const currentNotificationIds = notifications.map((n) => n.id);
          const clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
          const updatedClearedNotifications = [...new Set([...clearedNotifications, ...currentNotificationIds])];
          localStorage.setItem('clearedNotifications', JSON.stringify(updatedClearedNotifications));
        } catch (error) {
          console.error('Error storing cleared notifications in localStorage:', error);
        }

        set({ notifications: [], unreadCount: 0 });

        // Clear read status from localStorage
        try {
          localStorage.removeItem('readNotifications');
        } catch (error) {
          console.error('Error clearing read status from localStorage:', error);
        }

        return {
          success: true,
          message: 'All notifications cleared successfully',
        };
      } else {
        const errorMsg = response?.error || response?.detail || 'Failed to clear notifications';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return { success: false, error: error.message };
    }
  },

  // Clear specific notification
  clearNotification: async (apiKey, notificationId) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);

    try {
      const response = await apiClient.clearNotification(notificationId);

      if (response && response.success) {
        // Store cleared notifications in localStorage to prevent them from showing up again
        try {
          const clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
          if (!clearedNotifications.includes(notificationId)) {
            clearedNotifications.push(notificationId);
            localStorage.setItem('clearedNotifications', JSON.stringify(clearedNotifications));
          }
        } catch (error) {
          console.error('Error storing cleared notification in localStorage:', error);
        }

        const { notifications, unreadCount } = get();
        const updatedNotifications = notifications.filter((n) => n.id !== notificationId);
        const updatedUnreadCount = Math.max(0, unreadCount - 1);

        set({
          notifications: updatedNotifications,
          unreadCount: updatedUnreadCount,
        });

        // Remove from read status in localStorage
        try {
          const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
          const updatedReadNotifications = readNotifications.filter((id) => id !== notificationId);
          localStorage.setItem('readNotifications', JSON.stringify(updatedReadNotifications));
        } catch (error) {
          console.error('Error updating read status in localStorage:', error);
        }

        return {
          success: true,
          message: 'Notification cleared successfully',
        };
      } else {
        const errorMsg = response?.error || response?.detail || 'Failed to clear notification';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error clearing notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Test notifications
  testNotification: async (apiKey) => {
    if (!apiKey) {
      return { success: false, error: 'No API key provided' };
    }

    const apiClient = createApiClient(apiKey);

    try {
      const response = await apiClient.testNotification();

      if (response.success) {
        return { success: true, message: 'Test notification sent successfully' };
      } else {
        throw new Error(response.error || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Mark notification as read
  markAsRead: (notificationId) => {
    const { notifications, unreadCount } = get();
    const updatedNotifications = notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    );
    const updatedUnreadCount = Math.max(0, unreadCount - 1);

    set({
      notifications: updatedNotifications,
      unreadCount: updatedUnreadCount,
    });

    // Store read status in localStorage
    try {
      const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
      if (!readNotifications.includes(notificationId)) {
        readNotifications.push(notificationId);
        localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
      }
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  },

  // Mark all notifications as read
  markAllAsRead: () => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((notification) => ({ ...notification, read: true }));

    set({
      notifications: updatedNotifications,
      unreadCount: 0,
    });

    // Store all notification IDs as read in localStorage
    try {
      const allNotificationIds = notifications.map((n) => n.id);
      localStorage.setItem('readNotifications', JSON.stringify(allNotificationIds));
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  },

  // Add new notification (for real-time updates)
  addNotification: (notification) => {
    const { notifications, unreadCount } = get();
    set({
      notifications: [notification, ...notifications],
      unreadCount: notification.read ? unreadCount : unreadCount + 1,
    });
  },

  // Remove notification
  removeNotification: (notificationId) => {
    const { notifications, unreadCount } = get();
    set({
      notifications: notifications.filter((n) => n.id !== notificationId),
      unreadCount: Math.max(0, unreadCount - 1),
    });
  },

  // Set polling state
  setIsPolling: (isPolling) => {
    set({ isPolling });
  },

  // Manual retry function
  retryFetch: (apiKey) => {
    set({ consecutiveErrors: 0, lastErrorTime: null, error: null, isPolling: true });
    get().fetchNotifications(apiKey);
  },
}));
