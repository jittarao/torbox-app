import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createMockPollingScheduler,
} from './helpers/backendTestHelper.js';
import { setupAutomationRoutes } from '../automation.js';

function makeRule(overrides = {}) {
  return {
    name: 'Test Rule',
    enabled: true,
    assetTypes: ['torrent'],
    trigger: { type: 'interval', value: 60 },
    action: { type: 'archive' },
    conditions: [],
    logicOperator: 'and',
    ...overrides,
  };
}

describe('automation rule routes', () => {
  let env;
  let app;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupAutomationRoutes,
      pollingScheduler: createMockPollingScheduler(),
    });
  });

  afterEach(() => {
    cleanupBackendTestEnv(env);
  });

  test('GET /api/automation/rules returns an empty list', async () => {
    const res = await request(app).get('/api/automation/rules').set('x-api-key', env.apiKey).send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rules).toEqual([]);
  });

  test('POST /api/automation/rules creates a rule', async () => {
    const res = await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send({ rules: [makeRule({ name: 'Archive Old' })] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rules).toHaveLength(1);
    expect(res.body.rules[0].name).toBe('Archive Old');
    expect(res.body.rules[0].enabled).toBe(true);
  });

  test('PUT /api/automation/rules/:id toggles enabled status', async () => {
    const createRes = await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send({ rules: [makeRule({ name: 'Toggle Me' })] });
    const ruleId = createRes.body.rules[0].id;

    const res = await request(app)
      .put(`/api/automation/rules/${ruleId}`)
      .set('x-api-key', env.apiKey)
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app)
      .get('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send();
    expect(list.body.rules[0].enabled).toBe(false);
  });

  test('DELETE /api/automation/rules/:id removes the rule', async () => {
    const createRes = await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send({ rules: [makeRule({ name: 'Delete Me' })] });
    const ruleId = createRes.body.rules[0].id;

    const res = await request(app)
      .delete(`/api/automation/rules/${ruleId}`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = await request(app)
      .get('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send();
    expect(list.body.rules).toHaveLength(0);
  });

  test('POST /api/automation/rules/:id/run returns a successful result', async () => {
    const createRes = await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send({ rules: [makeRule({ name: 'Run Me' })] });
    const ruleId = createRes.body.rules[0].id;

    const res = await request(app)
      .post(`/api/automation/rules/${ruleId}/run`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toBeDefined();
  });
});
