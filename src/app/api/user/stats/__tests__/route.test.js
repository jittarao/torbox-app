import { describe, expect, test, mock, afterEach } from 'bun:test';

const API_BASE = 'https://api.test';
const API_VERSION = 'v1';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeGetRequest(search = '', apiKey = 'test-key') {
  const headers = apiKey ? { 'x-api-key': apiKey } : {};
  return new Request(`http://localhost/api/user/stats${search}`, {
    method: 'GET',
    headers,
  });
}

describe('GET /api/user/stats', () => {
  afterEach(() => {
    mock.restore();
  });

  test('returns 401 when API key is missing', async () => {
    mock.module('next/headers', () => ({
      headers: async () => new Headers(),
    }));
    const { GET } = await import('../route.js');

    const response = await GET(makeGetRequest('?general=true', null));
    expect(response.status).toBe(401);
  });

  test('maps general=true to bandwidth request (TorBox rejects general-only)', async () => {
    let requestedUrl = '';
    mock.module('next/headers', () => ({
      headers: async () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        requestedUrl = url;
        return jsonResponse({
          success: true,
          data: {
            general: {
              airlocked_downloads: 100,
              airlock_storage_limit: 1000,
            },
            bandwidth: [],
          },
        });
      },
    }));
    const { GET } = await import('../route.js');

    const response = await GET(makeGetRequest('?general=true'));
    expect(response.status).toBe(200);
    expect(requestedUrl).toBe(
      `${API_BASE}/${API_VERSION}/api/user/stats?bandwidth=true&bandwidth_grouping=week`
    );
    const body = await response.json();
    expect(body.data.general.airlocked_downloads).toBe(100);
  });

  test('forwards bandwidth params when bandwidth=true', async () => {
    let requestedUrl = '';
    mock.module('next/headers', () => ({
      headers: async () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/components/constants', () => ({
      API_BASE,
      API_VERSION,
      TORBOX_MANAGER_VERSION: 'test',
    }));
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: async (url) => {
        requestedUrl = url;
        return jsonResponse({ success: true, data: { bandwidth: [] } });
      },
    }));
    const { GET } = await import('../route.js');

    const response = await GET(makeGetRequest('?bandwidth=true&bandwidth_grouping=day'));
    expect(response.status).toBe(200);
    expect(requestedUrl).toBe(
      `${API_BASE}/${API_VERSION}/api/user/stats?bandwidth=true&bandwidth_grouping=day`
    );
  });
});
