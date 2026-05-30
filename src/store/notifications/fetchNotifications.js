import { createApiClient } from '@/utils/apiClient';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import {
  computeRateLimitBackoff,
  isConnectionError,
  isRateLimitMessage,
  parseNotificationResponse,
  shouldSkipNotificationFetch,
} from '@/store/notifications/notificationFetchUtils';

/**
 * Fetches notifications from the API. Returns a patch object for the store to apply.
 * Pure orchestration — no Zustand set/get calls.
 */
export async function fetchNotificationsRequest(apiKey, state, options = {}) {
  if (!apiKey) {
    return { patch: { error: 'API key is required', loading: false }, aborted: true };
  }
  if (!isValidTorboxApiKey(apiKey)) {
    return { patch: { fetchingNotifications: false, loading: false }, aborted: true };
  }
  if (shouldSkipNotificationFetch(state, options)) {
    return { aborted: true };
  }

  const { consecutiveErrors } = state;

  try {
    const apiClient = createApiClient(apiKey);
    const response = await apiClient.getNotifications();

    if (state.currentApiKey !== apiKey) {
      return { aborted: true };
    }

    if (response.success) {
      if (response.notModified) {
        return { aborted: true };
      }

      const notificationsWithReadStatus = parseNotificationResponse(response) || [];
      return {
        patch: {
          consecutiveErrors: 0,
          lastErrorTime: null,
          rateLimitBackoffUntil: null,
          notifications: notificationsWithReadStatus,
          loading: false,
          fetchingNotifications: false,
        },
      };
    }

    const errorMsg = response.error || 'Failed to fetch notifications';
    const errorTime = Date.now();

    if (response.isRateLimited || isRateLimitMessage(errorMsg)) {
      const newConsecutiveErrors = consecutiveErrors + 1;
      return {
        patch: {
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          rateLimitBackoffUntil:
            errorTime + computeRateLimitBackoff(newConsecutiveErrors, response.retryAfterMs),
          error: null,
          loading: false,
          fetchingNotifications: false,
        },
      };
    }

    return {
      patch: {
        error: errorMsg,
        consecutiveErrors: consecutiveErrors + 1,
        lastErrorTime: errorTime,
        loading: false,
        fetchingNotifications: false,
      },
    };
  } catch (error) {
    if (state.currentApiKey !== apiKey) {
      return { aborted: true };
    }

    if (!error.isRateLimited && !isRateLimitMessage(error.message)) {
      console.error('Error fetching notifications:', error);
    }

    const errorTime = Date.now();

    if (error.isRateLimited || isRateLimitMessage(error.message)) {
      const newConsecutiveErrors = consecutiveErrors + 1;
      return {
        patch: {
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          rateLimitBackoffUntil:
            errorTime + computeRateLimitBackoff(newConsecutiveErrors, error.retryAfterMs),
          error: null,
          loading: false,
          fetchingNotifications: false,
        },
      };
    }

    if (isConnectionError(error)) {
      const newConsecutiveErrors = consecutiveErrors + 1;
      return {
        patch: {
          consecutiveErrors: newConsecutiveErrors,
          lastErrorTime: errorTime,
          error: 'Connection timeout - notifications temporarily unavailable',
          loading: false,
          fetchingNotifications: false,
          ...(newConsecutiveErrors >= 3 ? { isPolling: false } : {}),
        },
      };
    }

    return {
      patch: {
        error: error.message,
        loading: false,
        fetchingNotifications: false,
      },
    };
  }
}
