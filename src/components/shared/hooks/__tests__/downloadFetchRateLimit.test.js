import { describe, expect, it } from 'bun:test';
import { createDownloadFetchRateLimiter } from '../downloadFetchRateLimit';
import { POLLING_CONFIG } from '../pollingConfig';

describe('downloadFetchRateLimiter', () => {
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

  it('blocks a type after maxCalls within the window', async () => {
    const limiter = createDownloadFetchRateLimiter();
    const gap =
      (POLLING_CONFIG.minIntervalByType.torrents || POLLING_CONFIG.minIntervalBetweenCallsMs) + 50;

    expect(limiter.acquire('torrents')).toBe(1);
    await Bun.sleep(gap);
    expect(limiter.acquire('torrents')).toBe(2);
    await Bun.sleep(gap);
    expect(limiter.acquire('torrents')).toBe(3);
    await Bun.sleep(gap);
    expect(limiter.acquire('torrents')).toBeNull();
  }, 10_000);

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
