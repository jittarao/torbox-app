import { afterEach, describe, expect, it, mock } from 'bun:test';
import { retryFetch } from '../retryFetch';

describe('retryFetch timeout', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it('aborts hung requests after the configured timeout', async () => {
    globalThis.fetch = mock(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );

    const result = await retryFetch('/api/torrents/download?torrent_id=1', {
      maxRetries: 1,
      timeout: 50,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Request timeout');
  });
});
