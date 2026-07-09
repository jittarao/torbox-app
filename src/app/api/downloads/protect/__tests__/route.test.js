import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('/api/downloads/protect', () => {
  afterEach(() => {
    mock.restore();
  });

  test('GET returns empty list when backend is disabled', async () => {
    mock.module('@/utils/backendCheck', () => ({
      isBackendDisabled: () => true,
    }));

    const { GET } = await import('../route.js');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.protected_ids).toEqual([]);
  });

  test('GET returns 401 when API key is missing', async () => {
    mock.module('@/utils/backendCheck', () => ({
      isBackendDisabled: () => false,
    }));
    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({
        response: Response.json({ success: false, error: 'API key is required' }, { status: 401 }),
      }),
    }));

    const { GET } = await import('../route.js');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  test('PUT returns 503 when backend is disabled', async () => {
    mock.module('@/utils/backendCheck', () => ({
      isBackendDisabled: () => true,
    }));

    const { PUT } = await import('../route.js');
    const response = await PUT(
      new Request('http://localhost/api/downloads/protect', {
        method: 'PUT',
        body: JSON.stringify({ download_ids: ['1'], protected: true }),
      })
    );

    expect(response.status).toBe(503);
  });

  test('GET proxies backend protected ids', async () => {
    mock.module('@/utils/backendCheck', () => ({
      isBackendDisabled: () => false,
    }));
    mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
      requireTorboxApiKey: async () => ({ apiKey: 'test-key' }),
    }));
    mock.module('@/utils/backendRequest', () => ({
      backendFetch: async () =>
        new Response(JSON.stringify({ success: true, protected_ids: ['42'] }), {
          status: 200,
        }),
      backendProxyHeaders: () => ({}),
    }));

    const { GET } = await import('../route.js');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.protected_ids).toEqual(['42']);
  });
});
