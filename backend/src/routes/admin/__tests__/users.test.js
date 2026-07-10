import { describe, expect, test, beforeAll, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createFakeUploadQuotaService,
} from '../../__tests__/helpers/backendTestHelper.js';
import { setupAdminRoutes } from '../../admin.js';

describe('admin users routes', () => {
  let env;
  let app;
  const adminKey = 'admin-test-key-0123456789abcdef';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = adminKey;
  });

  beforeEach(async () => {
    env = await createBackendTestEnv();
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupAdminRoutes,
      uploadQuotaService: createFakeUploadQuotaService(),
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('GET /api/admin/users lists the registered user', async () => {
    const res = await request(app).get('/api/admin/users').set('x-admin-key', adminKey).send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.users.some((u) => u.auth_id === env.authId)).toBe(true);
  });

  test('GET /api/admin/users/:authId returns the user', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${env.authId}`)
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.auth_id).toBe(env.authId);
  });

  test('PUT /api/admin/users/:authId/upload-tier updates the tier', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${env.authId}/upload-tier`)
      .set('x-admin-key', adminKey)
      .send({ tier: 'unlimited' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.quota.tier).toBe('unlimited');
  });

  test('PUT /api/admin/users/:authId/upload-tier rejects invalid tier', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${env.authId}/upload-tier`)
      .set('x-admin-key', adminKey)
      .send({ tier: 'premium' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('GET /api/admin/users/:authId/upload-quota returns quota info', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${env.authId}/upload-quota`)
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.quota.tier).toBe('limited');
  });

  test('POST /api/admin/users/:authId/trigger-poll delegates to polling scheduler', async () => {
    let triggerAuthId = null;
    const pollingScheduler = {
      triggerPoll: async (authId) => {
        triggerAuthId = authId;
        return { success: true, polled: true };
      },
    };

    const triggerApp = buildBackendApp({
      ...env,
      routeSetupFn: setupAdminRoutes,
      uploadQuotaService: createFakeUploadQuotaService(),
      pollingScheduler,
    });

    const res = await request(triggerApp)
      .post(`/api/admin/users/${env.authId}/trigger-poll`)
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.polled).toBe(true);
    expect(triggerAuthId).toBe(env.authId);
  });

  test('GET /api/admin/users rejects invalid activity filter', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .query({ activity: 'onlne' })
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Invalid activity filter');
  });
});
