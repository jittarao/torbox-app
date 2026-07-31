import { describe, expect, test, mock, beforeEach } from 'bun:test';

let inFlight = 0;
let maxInFlight = 0;

const fetchMock = mock(async () => {
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 40));
  inFlight -= 1;
  return { ok: true, status: 200, json: { images: {} }, text: '{}' };
});

mock.module('../safeExternalFetch.js', () => ({
  safeExternalFetch: (...args) => fetchMock(...args),
}));

const { tmdbFetch, TMDB_FETCH_CONCURRENCY, tmdbErrorPayload } = await import('../tmdbClient.js');

describe('tmdbFetch concurrency gate', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    inFlight = 0;
    maxInFlight = 0;
  });

  test('caps concurrent safeExternalFetch calls', async () => {
    expect(TMDB_FETCH_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(TMDB_FETCH_CONCURRENCY).toBeLessThanOrEqual(2);

    await Promise.all(Array.from({ length: 8 }, (_, i) => tmdbFetch('/configuration', `key-${i}`)));

    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(maxInFlight).toBeLessThanOrEqual(TMDB_FETCH_CONCURRENCY);
  });
});

describe('tmdbErrorPayload', () => {
  test('sanitizes Bun socket NETWORK_ERROR messages', () => {
    const payload = tmdbErrorPayload({
      code: 'NETWORK_ERROR',
      message:
        'The socket connection was closed unexpectedly. For more information, pass `verbose: true`',
    });
    expect(payload.status).toBe(502);
    expect(payload.body.code).toBe('NETWORK_ERROR');
    expect(payload.body.error).toBe('Could not reach TMDB. Please try again in a moment.');
    expect(payload.body.error).not.toContain('verbose');
  });

  test('maps TIMEOUT to 504 with friendly message', () => {
    const payload = tmdbErrorPayload({ code: 'TIMEOUT', message: 'Request timed out' });
    expect(payload.status).toBe(504);
    expect(payload.body.error).toContain('timed out');
  });

  test('preserves upstream HTTP status/message when present', () => {
    const payload = tmdbErrorPayload({
      status: 401,
      code: 'TMDB_INVALID_KEY',
      message: 'Invalid TMDB API key',
    });
    expect(payload).toEqual({
      status: 401,
      body: {
        success: false,
        error: 'Invalid TMDB API key',
        code: 'TMDB_INVALID_KEY',
      },
    });
  });
});
