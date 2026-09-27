import { describe, expect, test } from 'bun:test';
import { fetchPublicUploadStatus } from '../publicUploadStatus.js';

function statusRequest(ids) {
  return new Request('http://localhost/api/v1/uploads/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

describe('fetchPublicUploadStatus', () => {
  test('maps backend rows through the public mapper and preserves not_found', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            success: true,
            error: null,
            data: {
              uploads: [
                {
                  id: 42,
                  status: 'completed',
                  queue_order: null,
                  torbox_hash: 'abc',
                  torbox_torrent_id: 123,
                  torbox_auth_id: 9,
                  name: 'A',
                },
                { id: 44, status: 'queued', queue_order: 7, name: 'B' },
              ],
              not_found: [43],
            },
            meta: { requested: 3, found: 2, not_found: 1 },
          }),
          { status: 200 }
        );

      const response = await fetchPublicUploadStatus(statusRequest([42, 43, 44]), 'test-key');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.error).toBeNull();
      expect(body.data.uploads).toEqual([
        {
          upload_id: 42,
          status: 'completed',
          queue_order: null,
          hash: 'abc',
          torrent_id: 123,
          auth_id: 9,
          name: 'A',
        },
        {
          upload_id: 44,
          status: 'queued',
          queue_order: 7,
          hash: null,
          torrent_id: null,
          auth_id: null,
          name: 'B',
        },
      ]);
      expect(body.data.not_found).toEqual([43]);
      expect(body.meta).toEqual({ requested: 3, found: 2, not_found: 1 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('forwards 429 with Retry-After', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: 'Too many upload status requests, please try again later.',
          }),
          {
            status: 429,
            headers: { 'Retry-After': '30', 'RateLimit-Remaining': '0' },
          }
        );

      const response = await fetchPublicUploadStatus(statusRequest([1]), 'test-key');
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('30');
      expect(body.success).toBe(false);
      expect(body.error).toContain('Too many upload status requests');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('rejects an empty ids array without calling the backend', async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    try {
      globalThis.fetch = async () => {
        called = true;
        return new Response('{}');
      };

      const response = await fetchPublicUploadStatus(statusRequest([]), 'test-key');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(called).toBe(false);
      expect(body.error).toContain('ids array');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
