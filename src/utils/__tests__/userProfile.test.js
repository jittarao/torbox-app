import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('fetchUserProfile', () => {
  afterEach(() => {
    mock.restore();
  });

  test('dedupes concurrent requests for the same api key', async () => {
    let fetchCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: 1, plan: 0 },
        }),
        { status: 200 }
      );
    });

    const { fetchUserProfile } = await import('@/utils/userProfile');
    const apiKey = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const [first, second] = await Promise.all([fetchUserProfile(apiKey), fetchUserProfile(apiKey)]);

    expect(fetchCount).toBe(1);
    expect(first).toEqual({ id: 1, plan: 0 });
    expect(second).toEqual({ id: 1, plan: 0 });
  });
});

describe('fetchUserSubscriptions', () => {
  afterEach(() => {
    mock.restore();
  });

  test('dedupes concurrent subscription requests for the same api key', async () => {
    let fetchCount = 0;
    globalThis.fetch = mock(async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(
        JSON.stringify({
          success: true,
          data: [{ id: 1 }],
        }),
        { status: 200 }
      );
    });

    const { fetchUserSubscriptions } = await import('@/utils/userProfile');
    const apiKey = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    const [first, second] = await Promise.all([
      fetchUserSubscriptions(apiKey),
      fetchUserSubscriptions(apiKey),
    ]);

    expect(fetchCount).toBe(1);
    expect(first).toEqual([{ id: 1 }]);
    expect(second).toEqual([{ id: 1 }]);
  });
});
