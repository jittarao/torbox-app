import { describe, expect, test, mock, afterEach } from 'bun:test';
import { POST } from '../route.js';

describe('POST /api/uploads/batch rate-limit forwarding', () => {
  afterEach(() => {
    mock.restore();
    delete process.env.BACKEND_DISABLED;
  });

  test('forwards retry-after when file upload step returns 429', async () => {
    mock.module('next/headers', () => ({
      headers: async () =>
        new Headers({
          'x-api-key': 'test-api-key',
        }),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url) => {
      if (String(url).endsWith('/api/uploads/file')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Too many upload requests, please try again later.',
            detail: 'Upload rate limit exceeded.',
          }),
          {
            status: 429,
            headers: {
              'Retry-After': '45',
              'RateLimit-Remaining': '0',
            },
          }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const request = new Request('http://localhost/api/uploads/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploads: [
          {
            type: 'torrent',
            upload_type: 'file',
            file_data: 'dGVzdA==',
            filename: 'sample.torrent',
          },
        ],
      }),
    });

    const response = await POST(request);
    globalThis.fetch = originalFetch;

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('45');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Too many upload requests');
  });

  test('forwards retry-after when batch create step returns 429', async () => {
    mock.module('next/headers', () => ({
      headers: async () =>
        new Headers({
          'x-api-key': 'test-api-key',
        }),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url) => {
      if (String(url).endsWith('/api/uploads/batch')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Batch upload rate limited.',
            detail: 'Try again in one minute.',
          }),
          {
            status: 429,
            headers: {
              'Retry-After': '60',
              'RateLimit-Remaining': '0',
            },
          }
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const request = new Request('http://localhost/api/uploads/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploads: [
          {
            type: 'torrent',
            upload_type: 'magnet',
            link: 'magnet:?xt=urn:btih:abc',
          },
        ],
      }),
    });

    const response = await POST(request);
    globalThis.fetch = originalFetch;

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Batch upload rate limited.');
    expect(body.detail).toBe('Try again in one minute.');
  });
});
