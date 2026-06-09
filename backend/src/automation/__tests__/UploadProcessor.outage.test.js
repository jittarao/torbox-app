import { describe, expect, test } from 'bun:test';
import UploadProcessor from '../UploadProcessor.js';

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

describe('UploadProcessor outage handling', () => {
  test('handleConnectionDeferral keeps retry_count unchanged and defers queue', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.logUploadAttempt = () => {};

    const result = await processor.handleConnectionDeferral(
      { id: 3, authId: 'auth-1', retry_count: 1 },
      userDb,
      'torrent',
      Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' })
    );

    expect(result).toBe(false);

    const updateCall = userDb.calls.find(
      (call) =>
        call.sql.includes('UPDATE uploads') &&
        call.sql.includes('error_message') &&
        call.sql.includes('next_attempt_at')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall.sql).not.toContain('retry_count');
    expect(updateCall.sql).toContain('TorBox API unavailable. Will retry automatically.');
  });

  test('tryCompleteTorrentFromExistingList skips createtorrent when hash exists', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      decrementUploadCounter() {},
    });

    processor.handleSuccessfulUpload = () => {
      userDb.calls.push({ sql: 'handleSuccessfulUpload', params: [] });
    };

    const completed = await processor.tryCompleteTorrentFromExistingList(
      {
        id: 8,
        authId: 'auth-1',
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
        name: 'One',
      },
      userDb,
      'torrent',
      [
        {
          id: 42,
          hash: 'abcdef0123456789abcdef0123456789abcdef01',
          auth_id: 'torbox-auth',
          name: 'One',
        },
      ]
    );

    expect(completed).toBe(true);
    expect(userDb.calls.some((call) => call.sql === 'handleSuccessfulUpload')).toBe(true);
  });

  test('handleFailedUpload fails immediately on TorBox API error without re-queue', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.logUploadAttempt = () => {};

    await processor.handleFailedUpload(
      { id: 5, authId: 'auth-1', status: 'processing', retry_count: 0 },
      userDb,
      'torrent',
      Object.assign(new Error('Active download limit reached'), {
        response: {
          status: 200,
          data: {
            success: false,
            error: 'ACTIVE_LIMIT',
            detail: 'Active download limit reached',
          },
        },
      }),
      'queued'
    );

    const updateCall = userDb.calls.find((call) => call.sql.includes('UPDATE uploads'));
    expect(updateCall.params[0]).toBe('failed');
    expect(updateCall.params[1]).toBe('Active download limit reached');
    expect(updateCall.params[2]).toBe(1);
    expect(updateCall.params[3]).toBeNull();
  });
});
