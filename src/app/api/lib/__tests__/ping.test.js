import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

function mockMissingTorboxApiKey() {
  mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
    requireTorboxApiKey: async () => ({
      apiKey: null,
      response: Response.json({ success: false, error: 'API key is required' }, { status: 401 }),
    }),
  }));
}

function mockTorboxApiKey(apiKey = 'test-key') {
  mock.module('@/app/api/lib/requireTorboxApiKey', () => ({
    requireTorboxApiKey: async () => ({ apiKey, response: null }),
  }));
}

describe('/api/ping', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  test('returns 401 when API key is missing', async () => {
    mockMissingTorboxApiKey();

    const { POST } = await import('../../ping/route.js');
    const request = new Request('http://localhost/api/ping', {
      method: 'POST',
      body: JSON.stringify({ domain: 'https://example.com' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('API key is required');
  });

  test('returns 400 for localhost', async () => {
    mockTorboxApiKey();

    const { POST } = await import('../../ping/route.js');
    const request = new Request('http://localhost/api/ping', {
      method: 'POST',
      body: JSON.stringify({ domain: 'http://localhost' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('returns 400 for 169.254.169.254', async () => {
    mockTorboxApiKey();

    const { POST } = await import('../../ping/route.js');
    const request = new Request('http://localhost/api/ping', {
      method: 'POST',
      body: JSON.stringify({ domain: 'http://169.254.169.254/latest/meta-data/' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  test('returns 200 for a valid public URL', async () => {
    mockTorboxApiKey();

    global.fetch = mock(() =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );

    const { POST } = await import('../../ping/route.js');
    const request = new Request('http://localhost/api/ping', {
      method: 'POST',
      body: JSON.stringify({ domain: 'https://example.com', serverName: 'test' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.domain).toBe('https://example.com/');
    expect(body.status).toBe(200);
    expect(typeof body.ping).toBe('number');
  });
});
