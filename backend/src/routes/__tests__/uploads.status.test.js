import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
  buildUploadApp,
} from './helpers/uploadTestHelper.js';

describe('bulk upload status route', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    app = buildUploadApp(env);
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  async function createUploads(names, targetApp = app, apiKey = env.apiKey) {
    const res = await request(targetApp)
      .post('/api/uploads/batch')
      .set('x-api-key', apiKey)
      .send({
        uploads: names.map((name, i) => ({
          type: 'torrent',
          upload_type: 'magnet',
          url: `magnet:?xt=urn:btih:${name}-${i}`,
          name,
        })),
      });
    expect(res.status).toBe(200);
    return res.body.data.uploads;
  }

  test('returns found uploads plus not_found ids and meta counts', async () => {
    const created = await createUploads(['A', 'B', 'C']);
    const res = await request(app)
      .post('/api/uploads/status')
      .set('x-api-key', env.apiKey)
      .send({ ids: [created[2].id, created[0].id, 987654321] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data.uploads.map((u) => u.id)).toEqual([created[0].id, created[2].id]);
    expect(res.body.data.not_found).toEqual([987654321]);
    expect(res.body.meta).toEqual({ requested: 3, found: 2, not_found: 1 });
  });

  test('dedupes repeated ids and never reads another users uploads', async () => {
    const created = await createUploads(['Mine']);

    const deduped = await request(app)
      .post('/api/uploads/status')
      .set('x-api-key', env.apiKey)
      .send({ ids: [created[0].id, created[0].id] });
    expect(deduped.status).toBe(200);
    expect(deduped.body.meta).toEqual({ requested: 1, found: 1, not_found: 0 });

    const otherApiKey = 'tb-other-api-key-0123456789abcdef0123456789';
    await env.masterDatabase.registerApiKey(otherApiKey, 'other-key');

    const foreign = await request(app)
      .post('/api/uploads/status')
      .set('x-api-key', otherApiKey)
      .send({ ids: [created[0].id] });
    expect(foreign.status).toBe(200);
    expect(foreign.body.data.uploads).toHaveLength(0);
    expect(foreign.body.data.not_found).toEqual([created[0].id]);
  });

  test('rejects missing or non-numeric ids with 400', async () => {
    for (const body of [{}, { ids: [] }, { ids: 'nope' }, { ids: [0] }, { ids: ['abc'] }]) {
      const res = await request(app)
        .post('/api/uploads/status')
        .set('x-api-key', env.apiKey)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  test('rejects requests over UPLOAD_STATUS_BATCH_MAX with 400', async () => {
    const previous = process.env.UPLOAD_STATUS_BATCH_MAX;
    process.env.UPLOAD_STATUS_BATCH_MAX = '2';
    try {
      const res = await request(app)
        .post('/api/uploads/status')
        .set('x-api-key', env.apiKey)
        .send({ ids: [1, 2, 3] });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum 2 upload ids');
    } finally {
      if (previous === undefined) {
        delete process.env.UPLOAD_STATUS_BATCH_MAX;
      } else {
        process.env.UPLOAD_STATUS_BATCH_MAX = previous;
      }
    }
  });

  test('charges the shared status budget by id count and returns Retry-After on 429', async () => {
    const previousMax = process.env.UPLOAD_STATUS_RATE_LIMIT_MAX;
    process.env.UPLOAD_STATUS_RATE_LIMIT_MAX = '2';
    const limitedApp = buildUploadApp(env);

    try {
      const created = await createUploads(['One', 'Two'], limitedApp);

      const first = await request(limitedApp)
        .post('/api/uploads/status')
        .set('x-api-key', env.apiKey)
        .send({ ids: created.map((u) => u.id) });
      expect(first.status).toBe(200);

      // The 2-id bulk read consumed the whole 2-token budget; the single poll
      // route draws from the same budget and is now blocked.
      const single = await request(limitedApp)
        .get(`/api/uploads/${created[0].id}`)
        .set('x-api-key', env.apiKey);
      expect(single.status).toBe(429);
      expect(single.body.error).toContain('Too many upload status requests');

      const blocked = await request(limitedApp)
        .post('/api/uploads/status')
        .set('x-api-key', env.apiKey)
        .send({ ids: [created[0].id] });
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(blocked.body.error).toContain('Too many upload status requests');
    } finally {
      if (previousMax === undefined) {
        delete process.env.UPLOAD_STATUS_RATE_LIMIT_MAX;
      } else {
        process.env.UPLOAD_STATUS_RATE_LIMIT_MAX = previousMax;
      }
    }
  });
});
