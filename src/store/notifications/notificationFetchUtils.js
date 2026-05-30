import {
  getClearedNotifications,
  getReadNotifications,
} from '@/store/notifications/notificationStorage';

export const MIN_NOTIFICATION_FETCH_INTERVAL_MS = 60_000;
export const NOTIFICATION_POLL_INTERVAL_MS = 120_000;
const RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 600_000;

export function isRateLimitMessage(message) {
  return /429|too many requests/i.test(message || '');
}

export function isConnectionError(error) {
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

export function computeRateLimitBackoff(consecutiveErrors, retryAfterMs = 0) {
  return Math.max(
    retryAfterMs,
    Math.min(
      RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, consecutiveErrors - 1),
      MAX_RATE_LIMIT_BACKOFF_MS
    )
  );
}

export function parseNotificationResponse(response) {
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

  const clearedNotifications = getClearedNotifications();
  const readNotifications = getReadNotifications();

  return notificationData
    .filter((n) => !clearedNotifications.includes(n.id))
    .map((n) => ({
      ...n,
      read: n.read || readNotifications.includes(n.id),
    }));
}

export function shouldSkipNotificationFetch(state, { force = false } = {}) {
  if (!force) {
    const now = Date.now();
    if (state.rateLimitBackoffUntil && now < state.rateLimitBackoffUntil) return true;
    if (state.lastFetchTime && now - state.lastFetchTime < MIN_NOTIFICATION_FETCH_INTERVAL_MS) {
      return true;
    }

    const timeSinceLastError = state.lastErrorTime ? now - state.lastErrorTime : Infinity;
    const connectionBackoffTime = Math.min(30000 * Math.pow(2, state.consecutiveErrors), 300000);
    if (state.consecutiveErrors >= 3 && timeSinceLastError < connectionBackoffTime) {
      return true;
    }
  }
  return false;
}
