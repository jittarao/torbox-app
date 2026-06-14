import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { createDownloadFetchRateLimiter } from '../downloadFetchRateLimit';
import { POLLING_CONFIG } from '../pollingConfig';

describe('downloadFetchRateLimiter', () => {
  let origDateNow;
  let fakeNow;

  beforeEach(() => {
    origDateNow = Date.now;
    fakeNow = 100_000;
    Date.now = () => fakeNow;
  });

  afterEach(() => {
    Date.now = origDateNow;
  });

  // Helper: advance fake clock past the min interval for the given type
  function advancePastMinInterval(type) {
    const gap =
      (POLLING_CONFIG.minIntervalByType[type] || POLLING_CONFIG.minIntervalBetweenCallsMs) + 1;
    fakeNow += gap;
    return gap;
  }

  it('allows first fetch for each asset type without a shared global bucket', () => {
    const limiter = createDownloadFetchRateLimiter();
    expect(limiter.acquire('torrents')).toBe(1);
    expect(limiter.acquire('usenet')).toBe(1);
    expect(limiter.acquire('webdl')).toBe(1);
  });

  it('enforces min interval per type', () => {
    const limiter = createDownloadFetchRateLimiter();
    expect(limiter.acquire('torrents')).toBe(1);
    expect(limiter.acquire('torrents')).toBeNull();
  });

  it('blocks a type after maxCalls within the window', () => {
    const limiter = createDownloadFetchRateLimiter();

    expect(limiter.acquire('torrents')).toBe(1);
    advancePastMinInterval('torrents');
    expect(limiter.acquire('torrents')).toBe(2);
    advancePastMinInterval('torrents');
    expect(limiter.acquire('torrents')).toBe(3);
    advancePastMinInterval('torrents');
    // 4th call within the sliding window → blocked
    expect(limiter.acquire('torrents')).toBeNull();
  });

  it('canManualRefresh on all tab requires each type to have budget', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    expect(limiter.canManualRefresh('all')).toBe(false);
    expect(limiter.canManualRefresh('usenet')).toBe(true);
  });

  it('peekWouldBlock is per type only', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    expect(limiter.peekWouldBlock('torrents')).toBe(true);
    expect(limiter.peekWouldBlock('usenet')).toBe(false);
  });

  it('increments latest fetch id per type', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    expect(limiter.getLatestFetchId('torrents')).toBe(1);
    limiter.acquire('usenet');
    expect(limiter.getLatestFetchId('usenet')).toBe(1);
  });
});
