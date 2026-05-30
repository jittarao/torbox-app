import { create } from 'zustand';
import { createApiClient } from '@/utils/apiClient';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { getJSON, setItem, removeItem } from '@/utils/storage';

function getClearedNotifications() {
  return getJSON('clearedNotifications:v1') ?? getJSON('clearedNotifications') ?? [];
}

function getReadNotifications() {
  return getJSON('readNotifications:v1') ?? getJSON('readNotifications') ?? [];
}

const MIN_NOTIFICATION_FETCH_INTERVAL_MS = 60_000;
const NOTIFICATION_POLL_INTERVAL_MS = 120_000;
const RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 600_000;

function isRateLimitMessage(message) {
  return /429|too many requests/i.test(message || '');
}

function isConnectionError(error) {
  return (
    error.isTimeout ||
    error.message?.includes('timeout') ||
    error.message?.includes('Connect Timeout Error') ||
    error.message?.includes('Request timeout') ||
    error.message?.includes('Connection timeout') ||
    error.message?.includes('fetch failed') ||
    error.message?.includes('NetworkError') ||
    error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

function computeRateLimitBackoff(consecutiveErrors, retryAfterMs = 0) {
  return Math.max(
    retryAfterMs,
    Math.min(
      RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, consecutiveErrors - 1),
      MAX_RATE_LIMIT_BACKOFF_MS
    )
  );
}

function parseNotificationResponse(response) {
  if (!response.success) return null;

  let notificationData = [];

  if (response.data) {
    if (Array.isArray(response.data)) {
      notificationData = response.data;
    } else if (response.data.data && Array.isArray(response.data.data)) {
      notificationData = response.data.data;
    } else if (typeof response.data === 'object') {
      notificationData = [response.data];
    }
  } else if (Array.isArray(response)) {
    notificationData = response;
  }

  // Filter cleared and apply read status
  const clearedNotifications = getClearedNotifications();
  const readNotifications = getReadNotifications();

  return notificationData
    .filter((n) => !clearedNotifications.includes(n.id))
    .map((n) => ({
      ...n,
      read: n.read || readNotifications.includes(n.id),
    }));
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
  pollSubscribers: 0,
  pollTimerId: null,

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

    get().setApiKey(apiKey);

    if (fetchingNotifications) return;

    const now = Date.now();

    if (!force) {
      if (rateLimitBackoffUntil && now < rateLimitBackoffUntil) return;
      if (lastFetchTime && now - lastFetchTime < MIN_NOTIFICATION_FETCH_INTERVAL_MS) return;

      const timeSinceLastError = lastErrorTime ? now - lastErrorTime : Infinity;
      const connectionBackoffTime = Math.min(30000 * Math.pow(2, consecutiveErrors), 300000);
      if (consecutiveErrors >= 3 && timeSinceLastError < connectionBackoffTime) return;
    }

    const { notifications } = get();
    if (notifications.length === 0) set({ loading: true });
    set({ fetchingNotifications: true, error: null, lastFetchTime: now });

    try {
      if (get().currentApiKey !== apiKey) return;

      const apiClient = createApiClient(apiKey);
      const response = await apiClient.getNotifications();

      if (response.success) {
        set({
          consecutiveErrors: 0,
          lastErrorTime: null,
          rateLimitBackoffUntil: null,
        });

        const notificationsWithReadStatus = parseNotificationResponse(response) || [];

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
          set({
            consecutiveErrors: newConsecutiveErrors,
            lastErrorTime: errorTime,
            rateLimitBackoffUntil: errorTime + computeRateLimitBackoff(newConsecutiveErrors, response.retryAfterMs),
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
      if (get().currentApiKey !== apiKey) return;

      const errorTime = Date.now();

      if (error.isRateLimited || isRateLimitMessage(error.message)) {
        const newConsecutiveErrors = consecutiveErrors + 1;
        set({
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          rateLimitBackoffUntil: errorTime + computeRateLimitBackoff(newConsecutiveErrors, error.retryAfterMs),
          error: null,
          loading: false,
          fetchingNotifications: false,
        });
        return;
      }

      if (isConnectionError(error)) {
        const newConsecutiveErrors = consecutiveErrors + 1;
        set({
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          error: 'Connection timeout - notifications temporarily unavailable',
          loading: false,
          fetchingNotifications: false,
        });
        if (newConsecutiveErrors >= 3) {
          set({ isPolling: false });
        }
      } else {
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
          setItem('clearedNotifications:v1', JSON.stringify(updatedClearedNotifications));
        } catch (error) {
          console.error('Error storing cleared notifications:', error);
        }

        set({ notifications: [] });

        // Clear read status from localStorage
        try {
          removeItem('readNotifications:v1');
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
            setItem('clearedNotifications:v1', JSON.stringify(clearedNotifications));
          }
        } catch (error) {
          console.error('Error storing cleared notification:', error);
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
          setItem('readNotifications:v1', JSON.stringify(updatedReadNotifications));
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
        setItem('readNotifications:v1', JSON.stringify(readNotifications));
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
      setItem('readNotifications:v1', JSON.stringify(allNotificationIds));
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
    const { pollSubscribers, pollTimerId } = get();
    set({ pollSubscribers: pollSubscribers + 1 });

    if (!pollTimerId) {
      const tick = () => {
        const state = get();
        if (!state.currentApiKey) return;
        if (usePollingPauseStore.getState().isPaused) return;
        if (state.isPolling) {
          state.fetchNotifications(state.currentApiKey);
        }
      };
      set({ pollTimerId: setInterval(tick, NOTIFICATION_POLL_INTERVAL_MS) });
    }

    get().fetchNotifications(apiKey);
  },

  stopPolling: () => {
    const { pollSubscribers, pollTimerId } = get();
    const next = Math.max(0, pollSubscribers - 1);
    set({ pollSubscribers: next });
    if (next === 0 && pollTimerId) {
      clearInterval(pollTimerId);
      set({ pollTimerId: null });
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
