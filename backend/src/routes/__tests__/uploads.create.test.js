import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createUploadTestEnv,
  cleanupUploadTestEnv,
  buildUploadApp,
} from './helpers/uploadTestHelper.js';

describe('upload create routes', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createUploadTestEnv();
    app = buildUploadApp(env);
  });

  afterEach(() => {
    cleanupUploadTestEnv(env);
  });

  test('POST /api/uploads without required fields returns 400', async () => {
    const res = await request(app).post('/api/uploads').set('x-api-key', env.apiKey).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/type/i);
  });

  test('POST /api/uploads creates a queued torrent magnet upload', async () => {
    const res = await request(app).post('/api/uploads').set('x-api-key', env.apiKey).send({
      type: 'torrent',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abc123',
      name: 'Test Magnet',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('queued');
    expect(res.body.data.queue_order).toBe(0);
  });

  test('POST /api/uploads rejects invalid type', async () => {
    const res = await request(app).post('/api/uploads').set('x-api-key', env.apiKey).send({
      type: 'invalid',
      upload_type: 'magnet',
      url: 'magnet:?xt=urn:btih:abc123',
      name: 'Bad Type',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid type/i);
  });

  test('POST /api/uploads/batch creates uploads with distinct queue_order values', async () => {
    const uploads = Array.from({ length: 3 }, (_, i) => ({
      type: 'torrent',
      upload_type: 'magnet',
      url: `magnet:?xt=urn:btih:${i}`,
      name: `Batch ${i}`,
    }));

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploads).toHaveLength(3);

    const orders = res.body.data.uploads.map((u) => u.queue_order);
    expect(new Set(orders).size).toBe(3);
    expect(orders).toEqual([0, 1, 2]);
  });

  test('POST /api/uploads/batch returns per-row errors without failing the request', async () => {
    const uploads = [
      { type: 'torrent', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:a', name: 'Good' },
      { type: 'invalid', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:b', name: 'Bad type' },
    ];

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploads).toHaveLength(1);
    expect(res.body.meta.successful).toBe(1);
    expect(res.body.meta.failed).toBe(1);
  });

  test('POST /api/uploads/batch rejects more than 1000 uploads', async () => {
    const uploads = Array.from({ length: 1001 }, (_, i) => ({
      type: 'torrent',
      upload_type: 'magnet',
      url: `magnet:?xt=urn:btih:${i}`,
      name: `Overload ${i}`,
    }));

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
