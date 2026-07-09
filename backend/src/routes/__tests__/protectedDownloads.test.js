import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from './helpers/backendTestHelper.js';
import { setupProtectedDownloadsRoutes } from '../protectedDownloads.js';

describe('protected downloads routes', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupProtectedDownloadsRoutes,
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('GET returns empty list initially', async () => {
    const res = await request(app).get('/api/downloads/protect').set('x-api-key', env.apiKey);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.protected_ids).toEqual([]);
  });

  test('PUT protects downloads and GET reflects them', async () => {
    const putRes = await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1', '2'], protected: true });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.protected_ids).toEqual(expect.arrayContaining(['1', '2']));
    expect(putRes.body.protected_ids).toHaveLength(2);

    const getRes = await request(app).get('/api/downloads/protect').set('x-api-key', env.apiKey);

    expect(getRes.body.protected_ids).toEqual(expect.arrayContaining(['1', '2']));
    expect(getRes.body.protected_ids).toHaveLength(2);
  });

  test('PUT unprotects downloads', async () => {
    await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'], protected: true });

    const unprotect = await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'], protected: false });

    expect(unprotect.status).toBe(200);
    expect(unprotect.body.protected_ids).toEqual([]);
  });

  test('PUT returns full protected state after partial unprotect', async () => {
    await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1', '2'], protected: true });

    const unprotect = await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'], protected: false });

    expect(unprotect.status).toBe(200);
    expect(unprotect.body.protected_ids).toEqual(['2']);
  });

  test('POST assert returns allowed and blocked partitions', async () => {
    await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['blocked-1'], protected: true });

    const res = await request(app)
      .post('/api/downloads/protect/assert')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['blocked-1', 'allowed-1'], operation: 'delete' });

    expect(res.status).toBe(200);
    expect(res.body.allowed).toEqual(['allowed-1']);
    expect(res.body.blocked).toEqual(['blocked-1']);
  });

  test('POST assert returns 403 contract when all downloads are protected', async () => {
    await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'], protected: true });

    const res = await request(app)
      .post('/api/downloads/protect/assert')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'], operation: 'delete' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DOWNLOAD_PROTECTED');
    expect(res.body.error).toBe('Download is protected');
    expect(res.body.blocked_ids).toEqual(['1']);
  });

  test('PUT validates request body', async () => {
    const emptyIds = await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: [], protected: true });

    expect(emptyIds.status).toBe(400);

    const missingFlag = await request(app)
      .put('/api/downloads/protect')
      .set('x-api-key', env.apiKey)
      .send({ download_ids: ['1'] });

    expect(missingFlag.status).toBe(400);
  });
});
