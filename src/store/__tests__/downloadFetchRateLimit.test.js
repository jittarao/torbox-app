import { describe, expect, test, beforeEach } from 'bun:test';
import { createDownloadFetchRateLimiter } from '@/components/shared/hooks/downloadFetchRateLimit';

describe('downloadFetchRateLimiter forMutation', () => {
  let limiter;

  beforeEach(() => {
    limiter = createDownloadFetchRateLimiter();
  });

  test('forMutation bypasses min interval between calls', () => {
    expect(limiter.acquire('torrents')).not.toBeNull();
    expect(limiter.acquire('torrents')).toBeNull();
    expect(limiter.acquire('torrents', { forMutation: true })).not.toBeNull();
  });

  test('forMutation still respects max calls in sliding window', () => {
    expect(limiter.acquire('torrents', { forMutation: true })).not.toBeNull();
    expect(limiter.acquire('torrents', { forMutation: true })).not.toBeNull();
    expect(limiter.acquire('torrents', { forMutation: true })).not.toBeNull();
    expect(limiter.acquire('torrents', { forMutation: true })).toBeNull();
  });
});
