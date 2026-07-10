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
});
