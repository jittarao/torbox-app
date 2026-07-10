import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import ActivityTracker from '../../services/ActivityTracker.js';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
} from './helpers/backendTestHelper.js';
import { setupActivityRoutes } from '../activity.js';

describe('activity routes', () => {
  let env;
  let app;
  let activityTracker;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    activityTracker = new ActivityTracker(env.masterDatabase, { flushIntervalMs: 60_000 });
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupActivityRoutes,
      activityTracker,
    });
  });

  afterEach(() => {
    activityTracker?.stop();
    cleanupBackendTestEnv(env);
  });

  test('POST /api/activity records activity for registered user', async () => {
    const res = await request(app).post('/api/activity').set('x-api-key', env.apiKey).send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(activityTracker.isOnline(env.authId)).toBe(true);
  });

  test('POST /api/activity rejects missing API key', async () => {
    const res = await request(app).post('/api/activity').send();

    expect(res.status).toBe(401);
  });

  test('POST /api/activity rejects unregistered API key', async () => {
    const res = await request(app)
      .post('/api/activity')
      .set('x-api-key', 'tb-invalid-key-0123456789abcdef0123456789abcdef')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
