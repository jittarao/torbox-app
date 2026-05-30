import { describe, expect, test, mock, beforeEach } from 'bun:test';
import {
  computeRateLimitBackoff,
  isConnectionError,
  isRateLimitMessage,
  parseNotificationResponse,
  shouldSkipNotificationFetch,
  MIN_NOTIFICATION_FETCH_INTERVAL_MS,
} from '../notificationFetchUtils.js';

mock.module('@/store/notifications/notificationStorage', () => ({
  getClearedNotifications: () => ['cleared-1'],
  getReadNotifications: () => ['read-2'],
}));

describe('notificationFetchUtils', () => {
  test('isRateLimitMessage detects 429 text', () => {
    expect(isRateLimitMessage('HTTP 429 Too Many Requests')).toBe(true);
    expect(isRateLimitMessage('network error')).toBe(false);
  });

  test('isConnectionError detects timeout patterns', () => {
    expect(isConnectionError({ message: 'Connect Timeout Error', isTimeout: false })).toBe(true);
    expect(isConnectionError({ message: 'not found' })).toBe(false);
  });

  test('computeRateLimitBackoff grows with consecutive errors', () => {
    expect(computeRateLimitBackoff(1)).toBe(60_000);
    expect(computeRateLimitBackoff(3)).toBe(240_000);
    expect(computeRateLimitBackoff(10)).toBe(600_000);
    expect(computeRateLimitBackoff(1, 120_000)).toBe(120_000);
  });

  test('parseNotificationResponse filters cleared and marks read', () => {
    const result = parseNotificationResponse({
      success: true,
      data: [
        { id: 'cleared-1', title: 'A' },
        { id: 'read-2', title: 'B' },
        { id: 'new-3', title: 'C', read: false },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result.find((n) => n.id === 'read-2')?.read).toBe(true);
    expect(result.find((n) => n.id === 'new-3')?.read).toBe(false);
  });

  test('shouldSkipNotificationFetch respects rate limit backoff', () => {
    const now = Date.now();
    expect(
      shouldSkipNotificationFetch({
        rateLimitBackoffUntil: now + 60_000,
        lastFetchTime: null,
        consecutiveErrors: 0,
        lastErrorTime: null,
      })
    ).toBe(true);
  });

  test('shouldSkipNotificationFetch respects min fetch interval', () => {
    const now = Date.now();
    expect(
      shouldSkipNotificationFetch({
        rateLimitBackoffUntil: null,
        lastFetchTime: now - MIN_NOTIFICATION_FETCH_INTERVAL_MS + 1000,
        consecutiveErrors: 0,
        lastErrorTime: null,
      })
    ).toBe(true);
  });

  test('shouldSkipNotificationFetch allows force via options', () => {
    const now = Date.now();
    expect(
      shouldSkipNotificationFetch(
        {
          rateLimitBackoffUntil: now + 60_000,
          lastFetchTime: now,
          consecutiveErrors: 5,
          lastErrorTime: now,
        },
        { force: true }
      )
    ).toBe(false);
  });
});
