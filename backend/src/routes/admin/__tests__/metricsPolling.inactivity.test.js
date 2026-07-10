import { describe, expect, test, beforeAll, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createFakeUploadQuotaService,
} from '../../__tests__/helpers/backendTestHelper.js';
import { setupAdminRoutes } from '../../admin.js';

describe('admin metrics polling inactivity filter', () => {
  let env;
  let app;
  const adminKey = 'admin-test-key-0123456789abcdef';

  beforeAll(() => {
    process.env.ADMIN_API_KEY = adminKey;
  });

  beforeEach(async () => {
    env = await createBackendTestEnv();
    const pollingScheduler = {
      getStatus: () => ({
        inactivityFilter: {
          enabled: true,
          inactiveUserDays: 30,
          lastCycleEligible: 3,
          lastCycleSkippedInactive: 1,
          totalSkippedScheduled: 5,
          totalSkippedManual: 2,
          totalSkippedQueue: 4,
        },
      }),
    };
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupAdminRoutes,
      uploadQuotaService: createFakeUploadQuotaService(),
      pollingScheduler,
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('GET /api/admin/metrics/polling exposes inactivityFilter', async () => {
    const res = await request(app)
      .get('/api/admin/metrics/polling')
      .set('x-admin-key', adminKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.polling.inactivityFilter).toEqual({
      enabled: true,
      inactiveUserDays: 30,
      lastCycleEligible: 3,
      lastCycleSkippedInactive: 1,
      totalSkippedScheduled: 5,
      totalSkippedManual: 2,
      totalSkippedQueue: 4,
    });
  });
});
