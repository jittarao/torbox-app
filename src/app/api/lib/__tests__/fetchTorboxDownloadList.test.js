import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

function jsonResponse(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

const torboxFetchMock = mock(async () => jsonResponse({ success: true, data: [] }));

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
        return jsonResponse({ success: true, data: [] });
      }

      const offset = Number(new URL(url).searchParams.get('offset') || 0);
      const data = offset === 0 ? page0 : page1;

      return jsonResponse({ success: true, data });
    });

    const result = await fetchFullDownloadList('test-key', 'torrents');

    expect(result.pageCount).toBe(2);
    expect(result.data).toHaveLength(1001);
    expect(result.data.find((row) => row.id === 1000).name).toBe('item-1000-updated');
  });

  test('fetchMyListPage reports non-JSON gateway responses with the HTTP status', async () => {
    torboxFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => '<!DOCTYPE html><html>bad gateway</html>',
    });

    await expect(fetchMyListPage('test-key', 'torrents')).rejects.toThrow(/non-JSON \(HTTP 502\)/);
  });

  test('fetchMyListPage never surfaces [object Object] for object error payloads', async () => {
    torboxFetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { code: 'DATABASE_ERROR', detail: 'db down' } })
    );

    await expect(fetchMyListPage('test-key', 'torrents')).rejects.toThrow(/DATABASE_ERROR/);
  });
});
