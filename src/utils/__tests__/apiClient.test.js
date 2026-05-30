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
});
