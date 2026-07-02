import { describe, expect, test, mock, afterEach } from 'bun:test';

const API_BASE = 'https://api.test';
const API_VERSION = 'v1';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRequest(body, apiKey) {
  const headers = apiKey ? { 'x-api-key': apiKey } : {};
  return new Request('http://localhost/api/downloads/airlock', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/downloads/airlock', () => {
  afterEach(() => {
    mock.restore();
  });

  test('returns 401 when API key is missing', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers(),
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: 1, airlocked: true }));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 for invalid request body', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: '', airlocked: true }, 'test-key'));
    expect(response.status).toBe(400);

    const badType = await PUT(
      makeRequest({ assetType: 'invalid', id: 1, airlocked: true }, 'test-key')
    );
    expect(badType.status).toBe(400);

    const nonBoolean = await PUT(makeRequest({ assetType: 'torrent', id: 1, airlocked: 'true' }, 'test-key'));
    expect(nonBoolean.status).toBe(400);
  });

  test('returns 400 when download is queued', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        if (url.includes('getqueued')) {
          return jsonResponse({ success: true, data: [{ id: 42 }] });
        }
        return jsonResponse({ success: true, data: [] });
      },
      isTorboxFetchTimeout: () => false,
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: 42, airlocked: true }, 'test-key'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('queued');
  });

  test('returns 404 when download is not in mylist', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        if (url.includes('getqueued')) {
          return jsonResponse({ success: true, data: [] });
        }
        return jsonResponse({ success: true, data: [] });
      },
      isTorboxFetchTimeout: () => false,
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: 99, airlocked: true }, 'test-key'));
    expect(response.status).toBe(404);
  });

  test('returns upstream list error status', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        if (url.includes('getqueued')) {
          return jsonResponse({ success: true, data: [] });
        }
        return jsonResponse({ success: false, error: 'upstream failed' }, 503);
      },
      isTorboxFetchTimeout: () => false,
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: 1, airlocked: true }, 'test-key'));
    expect(response.status).toBe(503);
  });

  test('returns 502 when list body reports success false with HTTP 200', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        if (url.includes('getqueued')) {
          return jsonResponse({ success: true, data: [] });
        }
        return jsonResponse({ success: false, error: 'TorBox error' }, 200);
      },
      isTorboxFetchTimeout: () => false,
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'usenet', id: 5, airlocked: false }, 'test-key'));
    expect(response.status).toBe(502);
  });

  test('fetches current item and forwards preserved edit payload', async () => {
    const editBodies = [];
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url, options) => {
        if (url.includes('getqueued')) {
          return jsonResponse({ success: true, data: [] });
        }
        if (url.includes('mylist')) {
          return jsonResponse({
            success: true,
            data: {
              id: 7,
              name: 'Fresh name',
              tags: ['torbox'],
              alternativeHashes: ['hash-1'],
            },
          });
        }
        if (url.includes('editwebdownload')) {
          editBodies.push(JSON.parse(options.body));
          return jsonResponse({ success: true, data: { id: 7, airlocked: true } });
        }
        return jsonResponse({ success: false }, 404);
      },
      isTorboxFetchTimeout: () => false,
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(
      makeRequest({ assetType: 'webdl', id: 7, airlocked: true }, 'test-key')
    );
    expect(response.status).toBe(200);
    expect(editBodies).toHaveLength(1);
    expect(editBodies[0]).toEqual({
      webdl_id: 7,
      name: 'Fresh name',
      tags: ['torbox'],
      alternative_hashes: ['hash-1'],
      airlocked: true,
    });
  });

  test('returns 408 on TorBox fetch timeout', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    const timeoutError = new Error('timeout');
    timeoutError.name = 'TorboxTimeoutError';
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async () => {
        throw timeoutError;
      },
      isTorboxFetchTimeout: (error) => error?.name === 'TorboxTimeoutError',
    }));
    const { PUT } = await import('../route.js');

    const response = await PUT(makeRequest({ assetType: 'torrent', id: 1, airlocked: true }, 'test-key'));
    expect(response.status).toBe(408);
  });
});
