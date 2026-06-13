import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { POST } from '../../ping/route.js';

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
    mock.module('next/headers', () => ({
      headers: () => new Headers(),
    }));

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
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));

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
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));

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
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));

    global.fetch = mock(() =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      )
    );

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
