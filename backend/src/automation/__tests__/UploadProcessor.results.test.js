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

describe('UploadProcessor TorBox result persistence', () => {
  test('persists torrent hash, torrent_id, and auth_id after success', () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.handleSuccessfulUpload(
      { id: 42, authId: 'local-auth', type: 'torrent', upload_type: 'magnet', name: 'Test' },
      userDb,
      'torrent',
      {
        status: 200,
        data: {
          success: true,
          error: null,
          data: {
            hash: 'hash-value',
            torrent_id: 123,
            auth_id: 'torbox-auth',
          },
        },
      }
    );

    const updateCall = userDb.calls.find((call) => call.sql.includes('UPDATE uploads'));
    expect(updateCall.sql).toContain('torbox_hash');
    expect(updateCall.sql).toContain('torbox_torrent_id');
    expect(updateCall.sql).toContain('torbox_auth_id');
    expect(updateCall.params).toContain('hash-value');
    expect(updateCall.params).toContain(123);
    expect(updateCall.params).toContain('torbox-auth');
  });
});
