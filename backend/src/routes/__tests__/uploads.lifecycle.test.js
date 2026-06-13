import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
  buildUploadApp,
} from './helpers/uploadTestHelper.js';

describe('upload lifecycle routes', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    app = buildUploadApp(env);
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  async function createUpload(name = 'Lifecycle Upload') {
    const res = await request(app)
      .post('/api/uploads')
      .set('x-api-key', env.apiKey)
      .send({
        type: 'torrent',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:abc123',
        name,
      });
    expect(res.status).toBe(200);
    return res.body.data;
  }

  async function setUploadStatus(id, status) {
    const userDb = await env.userDatabaseManager.getUserDatabase(env.authId);
    try {
      userDb.db.prepare('UPDATE uploads SET status = ? WHERE id = ?').run(status, id);
    } finally {
      env.userDatabaseManager.releaseConnection(env.authId);
    }
  }

  async function getQueuedCount() {
    const row = env.masterDatabase.getQuery(
      'SELECT queued_uploads_count FROM user_registry WHERE auth_id = ?',
      [env.authId]
    );
    return row?.queued_uploads_count ?? 0;
  }

  test('POST /api/uploads/:id/retry re-queues a failed upload', async () => {
    const upload = await createUpload();
    await setUploadStatus(upload.id, 'failed');

    const res = await request(app)
      .post(`/api/uploads/${upload.id}/retry`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('queued');
    expect(res.body.data.queue_order).toBe(0);
  });

  test('POST /api/uploads/bulk/retry re-queues only failed uploads', async () => {
    const failedA = await createUpload('Failed A');
    const failedB = await createUpload('Failed B');
    const queued = await createUpload('Still Queued');

    await setUploadStatus(failedA.id, 'failed');
    await setUploadStatus(failedB.id, 'failed');

    const res = await request(app)
      .post('/api/uploads/bulk/retry')
      .set('x-api-key', env.apiKey)
      .send({ ids: [failedA.id, failedB.id, queued.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.retried).toBe(2);
    expect(res.body.data.requested).toBe(3);
  });

  test('DELETE /api/uploads/:id removes a queued upload and decrements counter', async () => {
    const upload = await createUpload();
    expect(await getQueuedCount()).toBe(1);

    const res = await request(app)
      .delete(`/api/uploads/${upload.id}`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await getQueuedCount()).toBe(0);

    const getRes = await request(app)
      .get(`/api/uploads/${upload.id}`)
      .set('x-api-key', env.apiKey)
      .send();
    expect(getRes.status).toBe(404);
  });

  test('DELETE /api/uploads/:id does not decrement counter for completed uploads', async () => {
    const upload = await createUpload();
    expect(await getQueuedCount()).toBe(1);

    await setUploadStatus(upload.id, 'completed');

    const res = await request(app)
      .delete(`/api/uploads/${upload.id}`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await getQueuedCount()).toBe(1);
  });
});
