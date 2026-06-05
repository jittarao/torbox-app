import { afterEach, describe, expect, mock, test } from 'bun:test';
import { isInactiveOrFailed } from '@/components/downloads/ActionBar/utils/statusHelpers';
import {
  buildShortMagnetLink,
  canRetryDownload,
  retryDownload,
} from '@/utils/retryDownload';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe('buildShortMagnetLink', () => {
  test('builds encoded short magnet link', () => {
    expect(
      buildShortMagnetLink({ hash: 'abc123', name: 'My Torrent' })
    ).toBe('magnet:?xt=urn:btih:abc123&dn=My%20Torrent');
  });

  test('falls back to Unknown display name', () => {
    expect(buildShortMagnetLink({ hash: 'abc123' })).toBe(
      'magnet:?xt=urn:btih:abc123&dn=Unknown'
    );
  });
});

describe('isInactiveOrFailed', () => {
  test('returns true for inactive downloads', () => {
    expect(
      isInactiveOrFailed({
        active: false,
        download_present: false,
        download_finished: true,
      })
    ).toBe(true);
  });

  test('returns true for failed downloads', () => {
    expect(
      isInactiveOrFailed({
        active: false,
        download_present: false,
        download_finished: false,
        download_state: 'failed',
      })
    ).toBe(true);
  });

  test('returns false for completed downloads', () => {
    expect(
      isInactiveOrFailed({
        active: false,
        download_present: true,
        download_finished: true,
        download_state: 'completed',
      })
    ).toBe(false);
  });
});

describe('canRetryDownload', () => {
  const inactiveTorrent = {
    active: false,
    download_present: false,
    download_finished: true,
    hash: 'deadbeef',
    tracker: 'http://tracker.example.com/announce',
    id: 1,
  };

  const inactiveWebdl = {
    active: false,
    download_present: false,
    download_finished: true,
    original_url: 'https://example.com/file.zip',
    id: 2,
    assetType: 'webdl',
  };

  const inactiveUsenet = {
    active: false,
    download_present: false,
    download_finished: true,
    id: 3,
    assetType: 'usenet',
  };

  test('allows inactive torrents with hash', () => {
    expect(canRetryDownload(inactiveTorrent, 'torrents')).toBe(true);
  });

  test('allows inactive torrents with id only for export fallback', () => {
    expect(canRetryDownload({ ...inactiveTorrent, hash: null }, 'torrents')).toBe(true);
  });

  test('rejects torrents without tracker', () => {
    expect(canRetryDownload({ ...inactiveTorrent, tracker: null }, 'torrents')).toBe(false);
    expect(canRetryDownload({ ...inactiveTorrent, tracker: '' }, 'torrents')).toBe(false);
    expect(canRetryDownload({ ...inactiveTorrent, tracker: '   ' }, 'torrents')).toBe(false);
  });

  test('allows inactive web downloads with original_url', () => {
    expect(canRetryDownload(inactiveWebdl, 'webdl')).toBe(true);
  });

  test('rejects usenet downloads', () => {
    expect(canRetryDownload(inactiveUsenet, 'usenet')).toBe(false);
  });

  test('rejects active downloads', () => {
    expect(
      canRetryDownload(
        {
          active: true,
          download_present: true,
          download_finished: false,
          download_state: 'downloading',
          hash: 'deadbeef',
        },
        'torrents'
      )
    ).toBe(false);
  });

  test('rejects webdl without original_url', () => {
    expect(
      canRetryDownload(
        {
          active: false,
          download_present: false,
          download_finished: true,
          assetType: 'webdl',
          id: 4,
        },
        'webdl'
      )
    ).toBe(false);
  });
});

describe('retryDownload', () => {
  test('falls back to full magnet export when hash is missing', async () => {
    mock.module('@/utils/uploadActions', () => ({
      uploadItem: mock(async (_apiKey, item) => {
        expect(item.data).toBe('magnet:?xt=urn:btih:full');
        return { success: true };
      }),
    }));

    globalThis.fetch = mock(async () => ({
      json: async () => ({
        success: true,
        data: 'magnet:?xt=urn:btih:full',
      }),
    }));

    const result = await retryDownload(
      'test-key',
      {
        id: 11,
        name: 'No Hash',
        active: false,
        download_present: false,
        download_finished: false,
        download_state: 'failed',
      },
      'torrents'
    );

    expect(result.success).toBe(true);
  });

  test('re-queues webdl from original_url', async () => {
    mock.module('@/utils/uploadActions', () => ({
      uploadItem: mock(async (_apiKey, item, options) => {
        expect(item.type).toBe('link');
        expect(item.data).toBe('https://example.com/file.zip');
        expect(options.assetType).toBe('webdl');
        return { success: true };
      }),
    }));

    const result = await retryDownload(
      'test-key',
      {
        id: 12,
        name: 'Web File',
        original_url: 'https://example.com/file.zip',
        active: false,
        download_present: false,
        download_finished: true,
        assetType: 'webdl',
      },
      'webdl'
    );

    expect(result.success).toBe(true);
  });

  test('returns error when webdl source url is missing', async () => {
    const result = await retryDownload(
      'test-key',
      {
        id: 13,
        name: 'Web File',
        active: false,
        download_present: false,
        download_finished: true,
        assetType: 'webdl',
      },
      'webdl'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('source_url_unavailable');
  });
});
