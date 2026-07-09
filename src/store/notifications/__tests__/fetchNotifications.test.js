import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('fetchNotificationsRequest', () => {
  afterEach(() => {
    mock.restore();
  });

  test('304 notModified does not clear notifications', async () => {
    mock.module('@/utils/apiClient', () => ({
      createApiClient: () => ({
        getNotifications: () => Promise.resolve({ success: true, notModified: true }),
      }),
    }));

    const { fetchNotificationsRequest } = await import('../fetchNotifications.js');

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
