import { describe, expect, test, mock, afterEach } from 'bun:test';
import { POST } from '../route.js';

describe('/api/backend/activity', () => {
  afterEach(() => {
    mock.restore();
    delete process.env.BACKEND_DISABLED;
  });

  test('returns success when backend is disabled', async () => {
    process.env.BACKEND_DISABLED = 'true';

    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('returns 401 when API key is missing', async () => {
    mock.module('next/headers', () => ({
      headers: async () => new Headers(),
    }));

    const response = await POST();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('API key is required');
  });

  test('soft-succeeds when backend connection is refused', async () => {
    mock.module('next/headers', () => ({
      headers: async () => new Headers({ 'x-api-key': 'test-key' }),
    }));
    mock.module('@/utils/backendRequest', () => ({
      backendProxyHeaders: (apiKey, extra = {}) => ({ 'x-api-key': apiKey, ...extra }),
      backendHttpRequest: async () => {
        const err = new Error('connect ECONNREFUSED 172.18.0.3:3001');
        err.code = 'ECONNREFUSED';
        throw err;
      },
    }));

    // Re-import after mocks so the route picks them up
    const { POST: postWithMocks } = await import(`../route.js?t=${Date.now()}`);
    const response = await postWithMocks();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.deferred).toBe(true);
  });
});
