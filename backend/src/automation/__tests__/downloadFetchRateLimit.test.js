import { describe, expect, test } from 'bun:test';
import { createDownloadFetchRateLimiter } from '../../../../src/components/shared/hooks/downloadFetchRateLimit.js';

describe('createDownloadFetchRateLimiter', () => {
  test('allows at most 3 global calls per 10s window', () => {
    const limiter = createDownloadFetchRateLimiter();
    expect(limiter.acquire('torrents')).toBe(1);
    expect(limiter.acquire('usenet')).toBe(1);
    expect(limiter.acquire('webdl')).toBe(1);
    expect(limiter.acquire('torrents')).toBeNull();
    expect(limiter.canManualRefresh('all')).toBe(false);
    expect(limiter.canManualRefresh('torrents')).toBe(false);
  });

  test('canManualRefresh on all tab requires room for three calls', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    expect(limiter.canManualRefresh('all')).toBe(false);
    expect(limiter.canManualRefresh('usenet')).toBe(true);
  });
});
