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

  test('POST /api/uploads/batch returns stable request indices and names on success', async () => {
    const uploads = Array.from({ length: 3 }, (_, i) => ({
      type: 'torrent',
      upload_type: 'magnet',
      url: `magnet:?xt=urn:btih:identity-${i}`,
      name: `Identity ${i}`,
    }));

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(200);
    const rows = res.body.data.uploads;
    expect(rows.map((u) => u.index)).toEqual([0, 1, 2]);
    expect(rows.map((u) => u.name)).toEqual(['Identity 0', 'Identity 1', 'Identity 2']);
    expect(res.body.data.errors).toBeUndefined();
    expect(res.body.meta).toEqual({ total: 3, successful: 3, failed: 0 });
  });

  test('POST /api/uploads/batch does not renumber indices after a failure', async () => {
    const uploads = [
      { type: 'torrent', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:a', name: 'Good 0' },
      { type: 'invalid', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:b', name: 'Bad 1' },
      { type: 'torrent', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:c', name: 'Good 2' },
      { type: 'torrent', upload_type: 'magnet', name: 'Bad 3' },
    ];

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(200);
    expect(res.body.data.uploads.map((u) => u.index)).toEqual([0, 2]);
    const errors = res.body.data.errors;
    expect(errors.map((e) => e.index)).toEqual([1, 3]);
    expect(errors.map((e) => e.code)).toEqual(['invalid_type', 'url_required']);
    expect(errors[1].name).toBe('Bad 3');
    expect(errors[0].upload).toMatchObject({ type: 'invalid' });
    expect(res.body.meta).toEqual({ total: 4, successful: 2, failed: 2 });
  });

  test('POST /api/uploads/batch emits a stable error code per validation branch', async () => {
    const uploads = [
      { upload_type: 'magnet', url: 'magnet:?xt=urn:btih:1', name: 'no-type' },
      { type: 'torrent', url: 'magnet:?xt=urn:btih:2', name: 'no-upload-type' },
      {
        type: 'usenet',
        upload_type: 'magnet',
        url: 'magnet:?xt=urn:btih:3',
        name: 'magnet-usenet',
      },
      { type: 'torrent', upload_type: 'magnet', url: 'magnet:?xt=urn:btih:4' },
      { type: 'torrent', upload_type: 'file', name: 'no-file-path' },
      { type: 'torrent', upload_type: 'file', file_path: 'sample.mp4', name: 'bad-extension' },
      { type: 'torrent', upload_type: 'file', file_path: 'unowned.torrent', name: 'bad-owner' },
      { type: 'torrent', upload_type: 'magnet', name: 'no-url' },
    ];

    const res = await request(app)
      .post('/api/uploads/batch')
      .set('x-api-key', env.apiKey)
      .send({ uploads });

    expect(res.status).toBe(200);
    expect(res.body.data.uploads).toHaveLength(0);
    expect(res.body.data.errors.map((e) => e.code)).toEqual([
      'invalid_type',
      'invalid_upload_type',
      'invalid_upload_type',
      'name_required',
      'file_path_required',
      'invalid_extension',
      'invalid_file_path',
      'url_required',
    ]);
    expect(res.body.data.errors.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(res.body.meta).toEqual({ total: 8, successful: 0, failed: 8 });
  });
});
