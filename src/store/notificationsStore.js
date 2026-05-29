import { create } from 'zustand';
import { createApiClient } from '@/utils/apiClient';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import { usePollingPauseStore } from '@/store/pollingPauseStore';

function getClearedNotifications() {
  try {
    return JSON.parse(
      localStorage.getItem('clearedNotifications:v1') ??
        (localStorage.getItem('clearedNotifications') || '[]')
    );
  } catch {
    return [];
  }
}

function getReadNotifications() {
  try {
    return JSON.parse(
      localStorage.getItem('readNotifications:v1') ??
        (localStorage.getItem('readNotifications') || '[]')
    );
  } catch {
    return [];
  }
}

const MIN_NOTIFICATION_FETCH_INTERVAL_MS = 60_000;
const NOTIFICATION_POLL_INTERVAL_MS = 120_000;
const RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 600_000;

function clearNotificationPollTimer(timer) {
  if (timer) {
    clearInterval(timer);
  }
}

function isRateLimitMessage(message) {
  return /429|too many requests/i.test(message || '');
}

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
  _pollTimer: null,
  _pollSubscribers: 0,

  // Reset notifications when API key changes
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

  // Fetch notifications from API
  fetchNotifications: async (apiKey, options = {}) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }
    // Never send invalid key to API (e.g. draft/partial input)
    if (!isValidTorboxApiKey(apiKey)) {
      set({ fetchingNotifications: false, loading: false });
      return;
    }

    const {
      currentApiKey,
      fetchingNotifications,
      consecutiveErrors,
      lastErrorTime,
      rateLimitBackoffUntil,
      lastFetchTime,
    } = get();
    const { force = false } = options;

    // Update API key in store (this will reset notifications if changed)
    get().setApiKey(apiKey);

    // Prevent duplicate concurrent calls: if already fetching, skip
    if (fetchingNotifications) {
      return;
    }

    const now = Date.now();

    if (!force) {
      if (rateLimitBackoffUntil && now < rateLimitBackoffUntil) {
        return;
      }

      if (lastFetchTime && now - lastFetchTime < MIN_NOTIFICATION_FETCH_INTERVAL_MS) {
        return;
      }

      // Back off after repeated connection errors
      const timeSinceLastError = lastErrorTime ? now - lastErrorTime : Infinity;
      const connectionBackoffTime = Math.min(30000 * Math.pow(2, consecutiveErrors), 300000);

      if (consecutiveErrors >= 3 && timeSinceLastError < connectionBackoffTime) {
        return;
      }
    }

    const { notifications } = get();
    // Don't show loading state if we already have notifications
    if (notifications.length === 0) {
      set({ loading: true });
    }
    set({ fetchingNotifications: true, error: null, lastFetchTime: now });

    try {
      if (get().currentApiKey !== apiKey) {
        return;
      }

      const apiClient = createApiClient(apiKey);
      const response = await apiClient.getNotifications();

      if (response.success) {
        // Reset error state on successful fetch
        set({
          consecutiveErrors: 0,
          lastErrorTime: null,
          rateLimitBackoffUntil: null,
        });

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
        const clearedNotifications = getClearedNotifications();

        const filteredNotifications = notificationData.filter(
          (notification) => !clearedNotifications.includes(notification.id)
        );

        // Get read notifications from localStorage
        const readNotifications = getReadNotifications();

        // Apply read status from localStorage
        const notificationsWithReadStatus = filteredNotifications.map((notification) => ({
          ...notification,
          read: notification.read || readNotifications.includes(notification.id),
        }));

        set({
          notifications: notificationsWithReadStatus,
          loading: false,
          fetchingNotifications: false,
        });
      } else {
        const errorMsg = response.error || 'Failed to fetch notifications';
        const errorTime = Date.now();

        if (response.isRateLimited || isRateLimitMessage(errorMsg)) {
          const newConsecutiveErrors = consecutiveErrors + 1;
          const backoffMs = Math.max(
            response.retryAfterMs || 0,
            Math.min(
              RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, newConsecutiveErrors - 1),
              MAX_RATE_LIMIT_BACKOFF_MS
            )
          );
          set({
            consecutiveErrors: newConsecutiveErrors,
            lastErrorTime: errorTime,
            rateLimitBackoffUntil: errorTime + backoffMs,
            error: null,
            loading: false,
            fetchingNotifications: false,
          });
          return;
        }

        set({
          error: errorMsg,
          consecutiveErrors: consecutiveErrors + 1,
          lastErrorTime: errorTime,
          loading: false,
          fetchingNotifications: false,
        });
      }
    } catch (error) {
      if (!error.isRateLimited && !isRateLimitMessage(error.message)) {
        console.error('Error fetching notifications:', error);
      }
      if (get().currentApiKey !== apiKey) {
        return;
      }
      const errorTime = Date.now();

      if (error.isRateLimited || isRateLimitMessage(error.message)) {
        const retryAfterMs = error.retryAfterMs || 0;
        const newConsecutiveErrors = consecutiveErrors + 1;
        const backoffMs = Math.max(
          retryAfterMs,
          Math.min(
            RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, newConsecutiveErrors - 1),
            MAX_RATE_LIMIT_BACKOFF_MS
          )
        );
        set({
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          rateLimitBackoffUntil: errorTime + backoffMs,
          error: null,
          loading: false,
          fetchingNotifications: false,
        });
        return;
      }

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
          lastErrorTime: errorTime,
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
    } finally {
      if (get().fetchingNotifications) {
        set({ fetchingNotifications: false, loading: false });
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
          const clearedNotifications = getClearedNotifications();
          const updatedClearedNotifications = [
            ...new Set([...clearedNotifications, ...currentNotificationIds]),
          ];
          localStorage.setItem(
            'clearedNotifications:v1',
            JSON.stringify(updatedClearedNotifications)
          );
        } catch (error) {
          console.error('Error storing cleared notifications in localStorage:', error);
        }

        set({ notifications: [] });

        // Clear read status from localStorage
        try {
          localStorage.removeItem('readNotifications:v1');
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
          const clearedNotifications = getClearedNotifications();
          if (!clearedNotifications.includes(notificationId)) {
            clearedNotifications.push(notificationId);
            localStorage.setItem('clearedNotifications:v1', JSON.stringify(clearedNotifications));
          }
        } catch (error) {
          console.error('Error storing cleared notification in localStorage:', error);
        }

        const { notifications } = get();
        const updatedNotifications = notifications.filter((n) => n.id !== notificationId);

        set({
          notifications: updatedNotifications,
        });

        // Remove from read status in localStorage
        try {
          const readNotifications = getReadNotifications();
          const updatedReadNotifications = readNotifications.filter((id) => id !== notificationId);
          localStorage.setItem('readNotifications:v1', JSON.stringify(updatedReadNotifications));
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
    const { notifications } = get();
    const updatedNotifications = notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );

    set({
      notifications: updatedNotifications,
    });

    // Store read status in localStorage
    try {
      const readNotifications = getReadNotifications();
      if (!readNotifications.includes(notificationId)) {
        readNotifications.push(notificationId);
        localStorage.setItem('readNotifications:v1', JSON.stringify(readNotifications));
      }
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  },

  // Mark all notifications as read
  markAllAsRead: () => {
    const { notifications } = get();
    const updatedNotifications = notifications.map((notification) => ({
      ...notification,
      read: true,
    }));

    set({
      notifications: updatedNotifications,
    });

    // Store all notification IDs as read in localStorage
    try {
      const allNotificationIds = notifications.map((n) => n.id);
      localStorage.setItem('readNotifications:v1', JSON.stringify(allNotificationIds));
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  },

  // Add new notification (for real-time updates)
  addNotification: (notification) => {
    const { notifications } = get();
    set({
      notifications: [notification, ...notifications],
    });
  },

  // Remove notification
  removeNotification: (notificationId) => {
    const { notifications } = get();
    set({
      notifications: notifications.filter((n) => n.id !== notificationId),
    });
  },

  // Set polling state
  setIsPolling: (isPolling) => {
    set({ isPolling });
  },

  startPolling: (apiKey) => {
    if (!apiKey) return;

    get().setApiKey(apiKey);
    const { _pollSubscribers, _pollTimer } = get();
    set({ _pollSubscribers: _pollSubscribers + 1 });

    if (!_pollTimer) {
      const tick = () => {
        const state = get();
        if (!state.currentApiKey) return;
        if (usePollingPauseStore.getState().isPollingPaused()) return;
        if (state.isPolling) {
          state.fetchNotifications(state.currentApiKey);
        }
      };
      set({ _pollTimer: setInterval(tick, NOTIFICATION_POLL_INTERVAL_MS) });
    }

    get().fetchNotifications(apiKey);
  },

  stopPolling: () => {
    const { _pollSubscribers, _pollTimer } = get();
    const next = Math.max(0, _pollSubscribers - 1);
    if (next === 0) {
      clearNotificationPollTimer(_pollTimer);
      set({ _pollTimer: null, _pollSubscribers: 0 });
    } else {
      set({ _pollSubscribers: next });
    }
  },

  // Manual retry function
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

export function selectUnreadCount(state) {
  let count = 0;
  for (let i = 0; i < state.notifications.length; i++) {
    if (!state.notifications[i].read) count++;
  }
  return count;
}
