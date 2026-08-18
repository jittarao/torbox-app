import { describe, expect, test, mock, afterEach } from 'bun:test';

describe('batchDeleteHelper', () => {
  afterEach(() => {
    mock.restore();
  });

  test('calls bulk-delete endpoint once with all ids', async () => {
    const fetchCalls = [];

    mock.module('@/utils/retryFetch', () => ({
      retryFetch: async (url, options) => {
        fetchCalls.push({ url, body: options.body });
        return { success: true, deleted_ids: [2, 3] };
      },
    }));

    const { batchDeleteHelper } = await import('../deleteHelpers.js');
    const result = await batchDeleteHelper([2, 3], 'test-key', 'torrents');

    expect(result).toEqual([2, 3]);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('/api/downloads/bulk-delete');
    expect(fetchCalls[0].body).toEqual({ ids: [2, 3], assetType: 'torrents' });
  });
});
