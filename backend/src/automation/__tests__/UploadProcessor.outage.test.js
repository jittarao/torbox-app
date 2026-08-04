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
        call.sql.includes('next_attempt_at') &&
        call.sql.includes('WHERE id = ?')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall.sql).not.toContain('retry_count');
    expect(updateCall.sql).toContain(`error_message = ?`);
    expect(updateCall.params[0]).toBe('TorBox API unavailable. Will retry automatically.');
  });

  test('processUpload calls createtorrent for torrent magnet uploads', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    let connectionDeferCalled = false;
    let apiRequestCalled = false;

    processor.handleConnectionDeferral = async () => {
      connectionDeferCalled = true;
      return false;
    };
    processor.isAtUncachedHourlyLimit = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });
    processor.makeApiRequest = async () => {
      apiRequestCalled = true;
      return {
        status: 200,
        data: {
          success: true,
          error: null,
          detail: 'OK',
          data: { hash: 'abc', torrent_id: 1, auth_id: 'torbox-auth' },
        },
      };
    };
    processor.handleSuccessfulUpload = () => {};

    const result = await processor.processUpload(
      {
        id: 10,
        authId: 'auth-1',
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
        name: 'Test',
      },
      userDb,
      'queued'
    );

    expect(connectionDeferCalled).toBe(false);
    expect(apiRequestCalled).toBe(true);
    expect(result.success).toBe(true);
    expect(result.stopTypeDrain).toBe(false);
  });

  test('first create timeout soft-defers only that upload and keeps draining', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.isAtUncachedHourlyLimit = () => false;
    processor.isUncachedCreateQuotaExhausted = () => false;
    processor.isTypeRateLimitBlocked = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });
    processor.makeApiRequest = async () => {
      throw Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' });
    };

    const result = await processor.processUpload(
      {
        id: 11,
        authId: 'auth-1',
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
        name: 'Timeout test',
      },
      userDb,
      'queued'
    );

    expect(result.success).toBe(false);
    expect(result.stopTypeDrain).toBe(false);

    const selfUpdate = userDb.calls.find(
      (call) =>
        call.sql.includes('UPDATE uploads') &&
        call.sql.includes('WHERE id = ?') &&
        call.params.includes(11)
    );
    expect(selfUpdate).toBeDefined();
    expect(selfUpdate.params[0]).toBe(
      'TorBox create timed out or failed to connect. Will retry shortly.'
    );

    const siblingPause = userDb.calls.find(
      (call) =>
        call.sql.includes('UPDATE uploads') &&
        call.sql.includes('AND id != ?') &&
        call.params.includes('TorBox API unavailable. Will retry automatically.')
    );
    expect(siblingPause).toBeUndefined();
  });

  test('consecutive create timeouts escalate to type-wide outage pause', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.isAtUncachedHourlyLimit = () => false;
    processor.isUncachedCreateQuotaExhausted = () => false;
    processor.isTypeRateLimitBlocked = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });
    processor.makeApiRequest = async () => {
      throw Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' });
    };

    const upload = {
      id: 12,
      authId: 'auth-1',
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
      name: 'Timeout escalate',
    };

    const first = await processor.processUpload({ ...upload, id: 12 }, userDb, 'queued');
    const second = await processor.processUpload({ ...upload, id: 13 }, userDb, 'queued');
    const third = await processor.processUpload({ ...upload, id: 14 }, userDb, 'queued');

    expect(first.stopTypeDrain).toBe(false);
    expect(second.stopTypeDrain).toBe(false);
    expect(third.success).toBe(false);
    expect(third.stopTypeDrain).toBe(true);

    const hardPause = userDb.calls.find(
      (call) =>
        call.sql.includes('UPDATE uploads') &&
        call.sql.includes('WHERE id = ?') &&
        call.params[0] === 'TorBox API unavailable. Will retry automatically.' &&
        call.params.includes(14)
    );
    expect(hardPause).toBeDefined();

    const siblingPause = userDb.calls.find(
      (call) =>
        call.sql.includes('AND id != ?') &&
        call.params.includes('TorBox API unavailable. Will retry automatically.')
    );
    expect(siblingPause).toBeDefined();
  });

  test('successful create resets connection strikes so next timeout is soft again', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.isAtUncachedHourlyLimit = () => false;
    processor.isUncachedCreateQuotaExhausted = () => false;
    processor.isTypeRateLimitBlocked = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });

    let shouldTimeout = true;
    processor.makeApiRequest = async () => {
      if (shouldTimeout) {
        throw Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' });
      }
      return {
        status: 200,
        data: {
          success: true,
          error: null,
          detail: 'OK',
          data: { hash: 'abc', torrent_id: 1, auth_id: 'torbox-auth' },
        },
      };
    };
    processor.handleSuccessfulUpload = () => {};

    const base = {
      authId: 'auth-1',
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abcdef0123456789abcdef0123456789abcdef01',
      name: 'Reset strikes',
    };

    await processor.processUpload({ ...base, id: 20 }, userDb, 'queued');
    await processor.processUpload({ ...base, id: 21 }, userDb, 'queued');

    shouldTimeout = false;
    const ok = await processor.processUpload({ ...base, id: 22 }, userDb, 'queued');
    expect(ok.success).toBe(true);

    shouldTimeout = true;
    const afterSuccess = await processor.processUpload({ ...base, id: 23 }, userDb, 'queued');
    expect(afterSuccess.stopTypeDrain).toBe(false);
  });

  test('HTTP 5xx hard-pauses the user type immediately (not soft-defer)', async () => {
    const userDb = createRecordingDb();
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.isAtUncachedHourlyLimit = () => false;
    processor.isUncachedCreateQuotaExhausted = () => false;
    processor.isTypeRateLimitBlocked = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });
    processor.makeApiRequest = async () => {
      throw Object.assign(new Error('Request failed with status code 500'), {
        code: 'ERR_BAD_RESPONSE',
        response: { status: 500, data: { detail: 'internal error' } },
      });
    };

    const result = await processor.processUpload(
      {
        id: 40,
        authId: 'auth-5xx',
        type: 'webdl',
        upload_type: 'url',
        url: 'https://example.com/file.bin',
        name: '5xx test',
      },
      userDb,
      'queued'
    );

    expect(result.success).toBe(false);
    expect(result.stopTypeDrain).toBe(true);

    const hardPause = userDb.calls.find(
      (call) =>
        call.sql.includes('UPDATE uploads') &&
        call.sql.includes('WHERE id = ?') &&
        call.params[0] === 'TorBox API unavailable. Will retry automatically.'
    );
    expect(hardPause).toBeDefined();
  });

  test('cross-user connection failures open a global create outage pause', async () => {
    const processor = new UploadProcessor(null, {
      updateUploadCounters: async () => {},
    });

    processor.isAtUncachedHourlyLimit = () => false;
    processor.isUncachedCreateQuotaExhausted = () => false;
    processor.isTypeRateLimitBlocked = () => false;
    processor.getApiClient = async () => ({});
    processor.buildFormData = async () => ({ getHeaders: () => ({}) });
    processor.makeApiRequest = async () => {
      throw Object.assign(new Error('Request failed with status code 500'), {
        code: 'ERR_BAD_RESPONSE',
        response: { status: 500 },
      });
    };

    for (let i = 0; i < 5; i++) {
      const userDb = createRecordingDb();
      await processor.processUpload(
        {
          id: 100 + i,
          authId: `auth-global-${i}`,
          type: 'webdl',
          upload_type: 'url',
          url: 'https://example.com/file.bin',
          name: `global ${i}`,
        },
        userDb,
        'queued'
      );
    }

    expect(processor.isGlobalConnectionPaused('webdl')).toBe(true);

    const quietDb = createRecordingDb();
    let apiCalled = false;
    processor.makeApiRequest = async () => {
      apiCalled = true;
      throw new Error('should not call TorBox while globally paused');
    };

    const paused = await processor.processUpload(
      {
        id: 999,
        authId: 'auth-after-pause',
        type: 'webdl',
        upload_type: 'url',
        url: 'https://example.com/file.bin',
        name: 'after pause',
      },
      quietDb,
      'queued'
    );

    expect(apiCalled).toBe(false);
    expect(paused.stopTypeDrain).toBe(true);
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
