import { describe, expect, test, beforeAll, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createFakeUploadQuotaService,
} from '../../__tests__/helpers/backendTestHelper.js';
import { setupAdminRoutes } from '../../admin.js';

describe('admin system routes', () => {
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

  test('GET /api/admin/system/upload-quota-summary returns summary', async () => {
    const res = await request(app)
      .get('/api/admin/system/upload-quota-summary')
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
  });

  test('POST /api/admin/system/enforce-upload-quotas completes successfully', async () => {
    const res = await request(app)
      .post('/api/admin/system/enforce-upload-quotas')
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/enforcement completed/i);
  });
});
