import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { fetchNotificationsRequest } from '../fetchNotifications.js';

describe('fetchNotificationsRequest', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('304 notModified does not clear notifications', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(null, {
          status: 304,
        })
      )
    );

    const apiKey = '7908ea44-023c-45f5-86ce-564bc6edaf34';
    const state = {
      currentApiKey: apiKey,
      consecutiveErrors: 0,
      notifications: [{ id: 'keep', title: 'Existing' }],
    };

    const result = await fetchNotificationsRequest(apiKey, state);

    expect(result.aborted).toBe(true);
    expect(result.patch).toBeUndefined();
  });
});
