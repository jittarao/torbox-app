import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { createApiClient } from '../apiClient.js';

describe('apiClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('304 Not Modified returns notModified without empty data', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(null, {
          status: 304,
          headers: { ETag: '"abc"' },
        })
      )
    );

    const client = createApiClient('test-key');
    const result = await client.getNotifications();

    expect(result.success).toBe(true);
    expect(result.notModified).toBe(true);
    expect(result.data).toBeUndefined();
  });

  test('200 response parses notification payload', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [{ id: 1, title: 'Hi' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const client = createApiClient('test-key');
    const result = await client.getNotifications();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1, title: 'Hi' }]);
    expect(result.notModified).toBeUndefined();
  });

  test('BAD_TOKEN is a hard auth failure', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: 'BAD_TOKEN',
            detail: 'The provided token is invalid.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const client = createApiClient('test-key');
    await expect(client.get('/api/notifications')).rejects.toThrow(/AUTH_ERROR/);
  });

  test('AUTH_ERROR is treated as TorBox server unavailability', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: 'AUTH_ERROR',
            detail: 'There was an error verifying your API key.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const client = createApiClient('test-key');
    try {
      await client.get('/api/notifications');
      throw new Error('expected rejection');
    } catch (error) {
      expect(error.isServiceUnavailable).toBe(true);
      expect(error.torboxError).toBe('AUTH_ERROR');
      expect(error.message).toContain('verifying');
    }
  });

  test('HTTP 200 with success:false still surfaces TorBox error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: false,
            error: 'DATABASE_ERROR',
            detail: 'Could not access internal database.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const client = createApiClient('test-key');
    try {
      await client.get('/api/notifications');
      throw new Error('expected rejection');
    } catch (error) {
      expect(error.isServiceUnavailable).toBe(true);
      expect(error.torboxError).toBe('DATABASE_ERROR');
    }
  });
});
