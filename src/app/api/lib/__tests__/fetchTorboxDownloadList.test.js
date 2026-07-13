import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const torboxFetchMock = mock(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: [] }),
}));

describe('fetchTorboxDownloadList', () => {
  let fetchFullDownloadList;
  let fetchQueuedList;
  let fetchMyListPage;

  beforeEach(async () => {
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: (...args) => torboxFetchMock(...args),
    }));

    ({ fetchFullDownloadList, fetchQueuedList, fetchMyListPage } =
      await import('../fetchTorboxDownloadList.js'));

    torboxFetchMock.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  test('fetchFullDownloadList deduplicates duplicate ids across pages', async () => {
    const page0 = Array.from({ length: 1000 }, (_, index) => ({
      id: index + 1,
      added: '2020-01-02',
      name: `item-${index + 1}`,
    }));
    const page1 = [
      { id: 1000, added: '2020-01-03', name: 'item-1000-updated' },
      { id: 1001, added: '2020-01-01', name: 'item-1001' },
    ];

    torboxFetchMock.mockImplementation(async (url) => {
      if (url.includes('getqueued')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      }

      const offset = Number(new URL(url).searchParams.get('offset') || 0);
      const data = offset === 0 ? page0 : page1;

      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data }),
      };
    });

    const result = await fetchFullDownloadList('test-key', 'torrents');

    expect(result.pageCount).toBe(2);
    expect(result.data).toHaveLength(1001);
    expect(result.data.find((row) => row.id === 1000).name).toBe('item-1000-updated');
  });
});
