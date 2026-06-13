import { describe, expect, test } from 'bun:test';
import {
  completeUploadWithTorboxResult,
  isDuplicateUploadFailure,
  markUploadsTorboxUnavailable,
  matchTorboxResource,
  resolveTorrentFromExistingList,
  splitRetriesByTorboxPresence,
  TORBOX_UNAVAILABLE_MESSAGE,
} from '../uploadDuplicateResolve.js';

function createRecordingDb() {
  const calls = [];
  return {
    calls,
    db: {
      prepare(sql) {
        return {
          run(...params) {
            calls.push({ sql, params });
            return { changes: 1 };
          },
        };
      },
    },
  };
}

describe('uploadDuplicateResolve', () => {
  test('isDuplicateUploadFailure detects already queued message', () => {
    expect(isDuplicateUploadFailure({ error_message: 'Download already queued.' })).toBe(true);
    expect(isDuplicateUploadFailure({ error_message: 'Active download limit reached' })).toBe(
      false
    );
  });

  test('matchTorboxResource prefers infohash match', () => {
    const torrents = [
      { id: 1, hash: 'aaa', name: 'Other' },
      { id: 2, hash: 'bbb', name: 'Target' },
    ];

    expect(matchTorboxResource({ name: 'Wrong' }, torrents, 'bbb')).toEqual({
      hash: 'bbb',
      torrentId: 2,
      authId: null,
    });
  });

  test('matchTorboxResource is case-insensitive for hex infohashes', () => {
    const torrents = [{ id: 1, hash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01', name: 'Target' }];

    expect(
      matchTorboxResource({ name: 'Wrong' }, torrents, 'abcdef0123456789abcdef0123456789abcdef01')
    ).toEqual({
      hash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
      torrentId: 1,
      authId: null,
    });
  });

  test('matchTorboxResource handles missing hash in TorBox list items', () => {
    const torrents = [
      { id: 1, hash: undefined, name: 'QueuedNoHash' },
      { id: 2, hash: 'abcdef0123456789abcdef0123456789abcdef01', name: 'Target' },
    ];

    expect(
      matchTorboxResource({ name: 'Wrong' }, torrents, 'abcdef0123456789abcdef0123456789abcdef01')
    ).toEqual({
      hash: 'abcdef0123456789abcdef0123456789abcdef01',
      torrentId: 2,
      authId: null,
    });
  });

  test('matchTorboxResource is case-insensitive for name fallback', () => {
    const torrents = [{ id: 1, hash: null, name: 'My Torrent Name' }];

    expect(matchTorboxResource({ name: 'my torrent name' }, torrents, null)).toEqual({
      hash: null,
      torrentId: 1,
      authId: null,
    });
  });

  test('matchTorboxResource matches hex expected hash against base32 TorBox hash', () => {
    const torrents = [
      {
        id: 1,
        hash: 'ROGO6RFRIZE26EIBT7IL5WWJZMOHTHNA',
        name: 'Target',
      },
    ];

    expect(
      matchTorboxResource({ name: 'Wrong' }, torrents, '8b8cef44b14649af11019fd0bedac9cb1c799da0')
    ).toEqual({
      hash: 'ROGO6RFRIZE26EIBT7IL5WWJZMOHTHNA',
      torrentId: 1,
      authId: null,
    });
  });

  test('splitRetriesByTorboxPresence completes duplicates with one TorBox fetch', async () => {
    const userDb = createRecordingDb();
    let fetchCount = 0;

    const failedUploads = [
      {
        id: 1,
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
        name: 'One',
        error_message: 'Download already queued.',
      },
      {
        id: 2,
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:1111111111111111111111111111111111111111',
        name: 'Two',
        error_message: 'Server error',
      },
    ];

    const result = await splitRetriesByTorboxPresence({
      failedUploads,
      authId: 'auth-1',
      userDb,
      getApiClient: async () => ({
        getTorrents: async () => {
          fetchCount++;
          return [
            {
              id: 99,
              hash: 'abcdef0123456789abcdef0123456789abcdef01',
              auth_id: 'torbox-auth',
              name: 'One',
              active: true,
              download_present: true,
              download_finished: true,
            },
          ];
        },
      }),
    });

    expect(fetchCount).toBe(1);
    expect(result.completedIds).toEqual([1]);
    expect(result.toRequeue.map((upload) => upload.id)).toEqual([2]);

    const updateCall = userDb.calls.find((call) => call.sql.includes("status = 'completed'"));
    expect(updateCall.params).toContain('abcdef0123456789abcdef0123456789abcdef01');
    expect(updateCall.params).toContain(99);
  });

  test('resolveTorrentFromExistingList returns null when torrent is absent', async () => {
    const resolved = await resolveTorrentFromExistingList(
      {
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
        name: 'Missing',
      },
      []
    );
    expect(resolved).toBeNull();
  });

  test('splitRetriesByTorboxPresence propagates connection errors', async () => {
    const userDb = createRecordingDb();
    const timeoutError = Object.assign(new Error('timeout of 30000ms exceeded'), {
      code: 'ECONNABORTED',
    });

    await expect(
      splitRetriesByTorboxPresence({
        failedUploads: [
          {
            id: 1,
            type: 'torrent',
            upload_type: 'magnet',
            url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
            name: 'One',
            error_message: 'Download already queued.',
          },
        ],
        authId: 'auth-1',
        userDb,
        getApiClient: async () => ({
          getTorrents: async () => {
            throw timeoutError;
          },
        }),
      })
    ).rejects.toThrow('timeout of 30000ms exceeded');
  });

  test('markUploadsTorboxUnavailable updates failed rows only', () => {
    const userDb = createRecordingDb();
    markUploadsTorboxUnavailable(userDb, [{ id: 9 }]);
    const updateCall = userDb.calls[0];
    expect(updateCall.sql).toContain("AND status = 'failed'");
    expect(updateCall.params).toContain(TORBOX_UNAVAILABLE_MESSAGE);
  });

  test('completeUploadWithTorboxResult only updates failed rows', () => {
    const userDb = createRecordingDb();
    completeUploadWithTorboxResult(userDb, 5, {
      hash: 'abc',
      torrentId: 10,
      authId: 'auth',
    });

    const updateCall = userDb.calls[0];
    expect(updateCall.sql).toContain("AND status = 'failed'");
  });
});
