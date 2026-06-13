import { describe, expect, test, mock, afterEach } from 'bun:test';
import { POST } from '../../speedtest/upload/route.js';

describe('/api/speedtest/upload', () => {
  afterEach(() => {
    mock.restore();
  });

  test('returns 401 when API key is missing', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers(),
    }));

    const formData = new FormData();
    formData.append('file', new File(['small'], 'test.txt', { type: 'text/plain' }));

    const request = new Request('http://localhost/api/speedtest/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('API key is required');
  });

  test('returns 400 when content-length exceeds the limit', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));

    const formData = new FormData();
    formData.append('file', new File(['x'], 'big.bin', { type: 'application/octet-stream' }));

    const request = new Request('http://localhost/api/speedtest/upload', {
      method: 'POST',
      headers: { 'content-length': String(20 * 1024 * 1024) },
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('10 MB');
  });

  test('returns 200 with fileSize for a small file', async () => {
    mock.module('next/headers', () => ({
      headers: () => new Headers({ 'x-api-key': 'test-key' }),
    }));

    const formData = new FormData();
    formData.append('file', new File(['hello'], 'test.txt', { type: 'text/plain' }));

    const request = new Request('http://localhost/api/speedtest/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.fileSize).toBe(5);
  });
});
