import { describe, expect, it } from 'bun:test';
import { createDownloadFetchRateLimiter } from '../downloadFetchRateLimit';

describe('downloadFetchRateLimiter', () => {
  it('allows up to globalMaxCalls within the window', () => {
    const limiter = createDownloadFetchRateLimiter();
    expect(limiter.acquire('torrents')).toBe(1);
    expect(limiter.acquire('usenet')).toBe(1);
    expect(limiter.acquire('webdl')).toBe(1);
    expect(limiter.acquire('torrents')).toBeNull();
  });

  it('canManualRefresh respects global budget', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    limiter.acquire('usenet');
    limiter.acquire('webdl');
    expect(limiter.canManualRefresh('torrents')).toBe(false);
  });

  it('peekWouldBlock after exhausting budget', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    limiter.acquire('usenet');
    limiter.acquire('webdl');
    expect(limiter.peekWouldBlock('torrents')).toBe(true);
  });

  it('increments latest fetch id per type', () => {
    const limiter = createDownloadFetchRateLimiter();
    limiter.acquire('torrents');
    expect(limiter.getLatestFetchId('torrents')).toBe(1);
    limiter.acquire('usenet');
    expect(limiter.getLatestFetchId('usenet')).toBe(1);
  });
});
