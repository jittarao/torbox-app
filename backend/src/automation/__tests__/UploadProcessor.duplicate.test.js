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
          get(...params) {
            calls.push({ sql, params, mode: 'get' });
            return null;
          },
          all(...params) {
            calls.push({ sql, params, mode: 'all' });
            return [];
          },
        };
      },
    },
  };
}

describe('UploadProcessor duplicate upload handling', () => {
  test('handleIdempotentDuplicate marks upload completed using existing TorBox item', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.logUploadAttempt = () => {};

    const apiClient = {
      getTorrents: async () => [
        {
          id: 999,
          hash: 'abc123',
          auth_id: 'torbox-auth',
          name: 'Example.torrent',
          status: 'queued',
        },
      ],
    };

    const upload = {
      id: 7,
      authId: 'local-auth',
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abc123&dn=Example.torrent',
      name: 'Example.torrent',
    };

    const completed = await processor.handleIdempotentDuplicate(
      upload,
      userDb,
      'torrent',
      {
        status: 200,
        data: {
          success: false,
          error: 'DUPLICATE_ITEM',
          detail: 'Download already queued.',
        },
      },
      apiClient
    );

    expect(completed).toBe(true);

    const updateCall = userDb.calls.find(
      (call) => call.sql.includes('UPDATE uploads') && call.sql.includes("status = 'completed'")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall.params).toContain('abc123');
    expect(updateCall.params).toContain(999);
    expect(updateCall.params).toContain('torbox-auth');
  });
});
