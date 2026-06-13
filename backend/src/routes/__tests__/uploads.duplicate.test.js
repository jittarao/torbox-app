import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
  buildUploadApp,
} from './helpers/uploadTestHelper.js';

describe('upload duplicate resolution routes', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    app = buildUploadApp({
      ...env,
      uploadProcessor: {
        isRunning: false,
        getApiClient: () =>
          Promise.resolve({
            getTorrents: (_includeQueued) =>
              Promise.resolve([
                {
                  name: 'Duplicate Magnet',
                  hash: 'abc123',
                  id: 99,
                  auth_id: env.authId,
                  active: true,
                  download_present: true,
                  download_finished: true,
                },
              ]),
          }),
      },
    });
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  async function createFailedDuplicate() {
    const res = await request(app).post('/api/uploads').set('x-api-key', env.apiKey).send({
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abc123',
      name: 'Duplicate Magnet',
    });
    expect(res.status).toBe(200);
    const id = res.body.data.id;

    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      userDb.db
        .prepare("UPDATE uploads SET status = 'failed', error_message = ? WHERE id = ?")
        .run('Download already queued.', id);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }

    return id;
  }

  test('POST /api/uploads/:id/retry completes a duplicate already present on TorBox', async () => {
    const id = await createFailedDuplicate();

    const res = await request(app)
      .post(`/api/uploads/${id}/retry`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.completedFromTorbox).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.torbox_torrent_id).toBe(99);
    expect(res.body.data.torbox_hash).toBe('abc123');
  });

  test('POST /api/uploads/bulk/retry completes duplicate and re-queues non-duplicate failures', async () => {
    const duplicateId = await createFailedDuplicate();

    const other = await request(app).post('/api/uploads').set('x-api-key', env.apiKey).send({
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:other',
      name: 'Other Failure',
    });
    const otherId = other.body.data.id;

    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      userDb.db
        .prepare("UPDATE uploads SET status = 'failed', error_message = ? WHERE id = ?")
        .run('Something went wrong', otherId);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }

    const res = await request(app)
      .post('/api/uploads/bulk/retry')
      .set('x-api-key', env.apiKey)
      .send({ ids: [duplicateId, otherId] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(1);
    expect(res.body.data.retried).toBe(1);
  });
});
