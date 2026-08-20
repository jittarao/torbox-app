import { describe, expect, test, mock, afterEach, afterAll } from 'bun:test';

const realTorboxFetch = await import('@/app/api/lib/torboxFetch');
const realDownloadProtectionGuard = await import('@/app/api/lib/downloadProtectionGuard');

const torboxFetchMock = mock();
const guardDestructiveOrRespondMock = mock(async () => null);

function restoreMockedModules() {
  mock.module('@/app/api/lib/torboxFetch', () => realTorboxFetch);
  mock.module('@/app/api/lib/downloadProtectionGuard', () => realDownloadProtectionGuard);
}

describe('deleteDownloadItem', () => {
  afterEach(() => {
    mock.restore();
    restoreMockedModules();
    torboxFetchMock.mockReset();
    guardDestructiveOrRespondMock.mockReset();
  });

  afterAll(() => {
    restoreMockedModules();
  });

  async function loadDeleteDownloadItem() {
    mock.module('@/app/api/lib/torboxFetch', () => ({
      torboxFetch: (...args) => torboxFetchMock(...args),
      isTorboxFetchTimeout: () => false,
    }));
    mock.module('@/app/api/lib/downloadProtectionGuard', () => ({
      guardDestructiveOrRespond: (...args) => guardDestructiveOrRespondMock(...args),
    }));

    return import('../deleteDownloadItem.js');
  }

  test('sends integer torrent_id to controltorrent for mylist items', async () => {
    torboxFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const { deleteDownloadItem } = await loadDeleteDownloadItem();
    const response = await deleteDownloadItem({
      apiKey: 'test-key',
      id: '42',
      assetType: 'torrents',
      queued: false,
    });

    expect(response.status).toBe(200);
    expect(torboxFetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = torboxFetchMock.mock.calls[0];
    expect(url).toContain('/api/torrents/controltorrent');
    expect(JSON.parse(options.body)).toEqual({ torrent_id: 42, operation: 'delete' });
  });

  test('routes queued items to controlqueued with queued_id', async () => {
    torboxFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const { deleteDownloadItem } = await loadDeleteDownloadItem();
    await deleteDownloadItem({
      apiKey: 'test-key',
      id: 9,
      assetType: 'torrents',
      queued: true,
    });

    const [url, options] = torboxFetchMock.mock.calls[0];
    expect(url).toContain('/api/queued/controlqueued');
    expect(JSON.parse(options.body)).toEqual({
      queued_id: 9,
      operation: 'delete',
      type: 'torrent',
    });
  });

  test('returns AUTH_ERROR without treating it as success', async () => {
    torboxFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: 'AUTH_ERROR', detail: 'verify failed' }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const { deleteDownloadItem } = await loadDeleteDownloadItem();
    const response = await deleteDownloadItem({
      apiKey: 'test-key',
      id: 7,
      assetType: 'torrents',
      queued: false,
    });
    const body = await response.json();

    expect(body).toMatchObject({ success: false, error: 'AUTH_ERROR' });
  });
});
