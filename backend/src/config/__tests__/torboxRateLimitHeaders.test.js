import { describe, expect, test } from 'bun:test';
import {
  applyParsedHeaders,
  createEmptyRateLimitState,
  getRateLimitAvailability,
  getRateLimitResumeWaitMs,
  getRateLimitSnapshotForApi,
  isCachedRateLimitEnvelope,
  isRateLimitBlocked,
  isUncachedHourlyRateLimitDetail,
  isUncachedRateLimitEnvelope,
  normalizeExpiredRateLimitState,
  normalizeResetAtMs,
  parseTorboxRateLimitHeaders,
} from '../torboxRateLimitHeaders.js';

describe('torboxRateLimitHeaders', () => {
  const nowMs = 1_700_000_000_000;

  test('parseTorboxRateLimitHeaders reads x-ratelimit-* and retry-after', () => {
    const parsed = parseTorboxRateLimitHeaders(
      {
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '42',
        'x-ratelimit-reset': '120',
        'retry-after': '90',
      },
      nowMs
    );

    expect(parsed.limit).toBe(60);
    expect(parsed.remaining).toBe(42);
    expect(parsed.resetAtMs).toBe(nowMs + 120_000);
    expect(parsed.retryAfterSeconds).toBe(90);
  });

  test('parseTorboxRateLimitHeaders accepts ratelimit-* aliases', () => {
    const parsed = parseTorboxRateLimitHeaders(
      {
        'ratelimit-limit': '30',
        'ratelimit-remaining': '5',
        'ratelimit-reset': '1700000060',
      },
      nowMs
    );

    expect(parsed.limit).toBe(30);
    expect(parsed.remaining).toBe(5);
    expect(parsed.resetAtMs).toBe(1_700_000_060_000);
  });

  test('normalizeResetAtMs treats large values as unix timestamps', () => {
    expect(normalizeResetAtMs('1700000060', nowMs)).toBe(1_700_000_060_000);
  });

  test('normalizeResetAtMs accepts float unix timestamps', () => {
    expect(normalizeResetAtMs('1785453098.556586', nowMs)).toBe(1_785_453_098_000);
  });

  test('isUncachedRateLimitEnvelope / isCachedRateLimitEnvelope classify by limit', () => {
    expect(isUncachedRateLimitEnvelope({ limit: 60 })).toBe(true);
    expect(isUncachedRateLimitEnvelope({ limit: 300 })).toBe(false);
    expect(isCachedRateLimitEnvelope({ limit: 300 })).toBe(true);
    expect(isCachedRateLimitEnvelope({ limit: 60 })).toBe(false);
  });

  test('isUncachedHourlyRateLimitDetail matches TorBox 429 body', () => {
    expect(isUncachedHourlyRateLimitDetail('60 per 1 hour')).toBe(true);
    expect(isUncachedHourlyRateLimitDetail({ detail: '60 per 1 hour' })).toBe(true);
    expect(isUncachedHourlyRateLimitDetail('too many requests')).toBe(false);
  });

  test('getRateLimitSnapshotForApi hides cached envelopes', () => {
    const snapshot = getRateLimitSnapshotForApi(
      {
        limit: 300,
        remaining: 297,
        resetAtMs: nowMs + 30_000,
        observedAtMs: nowMs,
      },
      nowMs
    );
    expect(snapshot.known).toBe(false);
    expect(snapshot.limit).toBeNull();
  });

  test('isRateLimitBlocked is true only when remaining is zero before reset', () => {
    const blocked = {
      limit: 60,
      remaining: 0,
      resetAtMs: nowMs + 60_000,
      observedAtMs: nowMs,
    };
    expect(isRateLimitBlocked(blocked, nowMs)).toBe(true);
    expect(isRateLimitBlocked(blocked, nowMs + 60_000)).toBe(false);
  });

  test('getRateLimitAvailability returns tri-state for sync decisions', () => {
    expect(
      getRateLimitAvailability(
        { limit: 60, remaining: 0, resetAtMs: nowMs + 60_000, observedAtMs: nowMs },
        nowMs
      )
    ).toBe('blocked');
    expect(
      getRateLimitAvailability(
        { limit: 60, remaining: 5, resetAtMs: nowMs + 60_000, observedAtMs: nowMs },
        nowMs
      )
    ).toBe('available');
    expect(getRateLimitAvailability(createEmptyRateLimitState(nowMs), nowMs)).toBe('unknown');
  });

  test('isRateLimitBlocked ignores retry-after when remaining is positive', () => {
    const state = {
      limit: 60,
      remaining: 10,
      resetAtMs: nowMs + 90_000,
      observedAtMs: nowMs,
    };
    expect(isRateLimitBlocked(state, nowMs)).toBe(false);
    expect(getRateLimitResumeWaitMs(state, { retryAfterSeconds: 90 }, 300_000, nowMs)).toBe(0);
  });

  test('getRateLimitResumeWaitMs uses shorter retry-after when blocking', () => {
    const state = {
      limit: 60,
      remaining: 0,
      resetAtMs: nowMs + 120_000,
      observedAtMs: nowMs,
    };

    expect(getRateLimitResumeWaitMs(state, { retryAfterSeconds: 45 }, 300_000, nowMs)).toBe(45_000);
  });

  test('normalizeExpiredRateLimitState clears orphan block after fallback elapses', () => {
    const state = {
      limit: 60,
      remaining: 0,
      resetAtMs: null,
      observedAtMs: nowMs - 6 * 60 * 1000,
    };
    const next = normalizeExpiredRateLimitState(state, nowMs, 5 * 60 * 1000);
    expect(next.remaining).toBeNull();
    expect(isRateLimitBlocked(next, nowMs)).toBe(false);
  });

  test('applyParsedHeaders clears stale remaining when header is absent', () => {
    const base = {
      limit: 60,
      remaining: 10,
      resetAtMs: nowMs + 60_000,
      observedAtMs: nowMs - 1000,
    };
    const next = applyParsedHeaders(
      base,
      parseTorboxRateLimitHeaders({ 'x-ratelimit-limit': '60' }, nowMs),
      nowMs,
      { clearRemainingIfAbsent: true }
    );
    expect(next.remaining).toBeNull();
    expect(next.limit).toBe(60);
  });

  test('getRateLimitResumeWaitMs uses retry-after when blocking without reset', () => {
    const state = {
      limit: 60,
      remaining: 0,
      resetAtMs: null,
      observedAtMs: nowMs,
    };

    expect(getRateLimitResumeWaitMs(state, { retryAfterSeconds: 30 }, 300_000, nowMs)).toBe(30_000);
  });

  test('normalizeExpiredRateLimitState clears remaining after reset', () => {
    const state = {
      limit: 60,
      remaining: 0,
      resetAtMs: nowMs,
      observedAtMs: nowMs - 60_000,
    };
    const next = normalizeExpiredRateLimitState(state, nowMs);
    expect(next.remaining).toBeNull();
    expect(next.resetAtMs).toBeNull();
  });

  test('applyParsedHeaders overwrites remaining from response', () => {
    const base = createEmptyRateLimitState(nowMs);
    const next = applyParsedHeaders(
      base,
      parseTorboxRateLimitHeaders(
        {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '30',
        },
        nowMs
      ),
      nowMs
    );

    expect(next.remaining).toBe(0);
    expect(next.limit).toBe(60);
    expect(isRateLimitBlocked(next, nowMs)).toBe(true);
  });

  test('getRateLimitSnapshotForApi exposes known flag and used count', () => {
    const snapshot = getRateLimitSnapshotForApi(
      {
        limit: 60,
        remaining: 15,
        resetAtMs: nowMs + 120_000,
        observedAtMs: nowMs,
      },
      nowMs
    );

    expect(snapshot.known).toBe(true);
    expect(snapshot.used).toBe(45);
    expect(snapshot.remaining).toBe(15);
    expect(snapshot.resetAt).not.toBeNull();
  });
});
