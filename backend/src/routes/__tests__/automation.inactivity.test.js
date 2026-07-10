import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import ActivityTracker from '../../services/ActivityTracker.js';
import { formatSqliteUtc } from '../../utils/sqliteDatetime.js';
import cache from '../../utils/cache.js';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createMockPollingScheduler,
} from './helpers/backendTestHelper.js';
import { setupAutomationRoutes } from '../automation.js';

const ENV_KEY = 'AUTOMATION_INACTIVE_USER_DAYS';
const REFERENCE_MS = Date.parse('2026-07-10T12:00:00.000Z');
const CUTOFF_30D = formatSqliteUtc(new Date(REFERENCE_MS - 30 * 24 * 60 * 60 * 1000));

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

function setLastSeenAt(masterDatabase, authId, lastSeenAt) {
  masterDatabase.runQuery('UPDATE user_registry SET last_seen_at = ? WHERE auth_id = ?', [
    lastSeenAt,
    authId,
  ]);
  cache.invalidateUserRegistry(authId);
}

describe('automation inactivity gating on manual rule run', () => {
  let env;
  let app;
  let savedEnv;
  let ruleId;
  let pollingScheduler;

  beforeEach(async () => {
    savedEnv = process.env[ENV_KEY];
    process.env[ENV_KEY] = '30';

    env = await createBackendTestEnv();
    pollingScheduler = {
      ...createMockPollingScheduler(),
      recordInactivitySkip: () => {},
    };
    app = buildBackendApp({
      ...env,
      routeSetupFn: setupAutomationRoutes,
      pollingScheduler,
      activityTracker: new ActivityTracker(env.masterDatabase, { flushIntervalMs: 60_000 }),
    });

    const createRes = await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send({ rules: [makeRule({ name: 'Run Me' })] });
    ruleId = createRes.body.rules[0].id;
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = savedEnv;
    }
    cleanupBackendTestEnv(env);
  });

  test('reactivates returning user without activity tracker via direct DB persist', async () => {
    setLastSeenAt(env.masterDatabase, env.authId, '2026-06-01 00:00:00');

    const appWithoutTracker = buildBackendApp({
      ...env,
      routeSetupFn: setupAutomationRoutes,
      pollingScheduler,
      activityTracker: null,
    });

    const res = await request(appWithoutTracker)
      .post(`/api/automation/rules/${ruleId}/run`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const userInfo = env.masterDatabase.getUserRegistryInfo(env.authId);
    expect(userInfo.last_seen_at >= CUTOFF_30D).toBe(true);
  });

  test('succeeds when last_seen_at is within the activity window', async () => {
    setLastSeenAt(env.masterDatabase, env.authId, '2026-07-01 00:00:00');

    const res = await request(app)
      .post(`/api/automation/rules/${ruleId}/run`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result).toBeDefined();
  });

  test('succeeds when last_seen_at is NULL', async () => {
    setLastSeenAt(env.masterDatabase, env.authId, null);

    const res = await request(app)
      .post(`/api/automation/rules/${ruleId}/run`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('reactivates returning user immediately via fast-persist', async () => {
    setLastSeenAt(env.masterDatabase, env.authId, '2026-06-01 00:00:00');

    const res = await request(app)
      .post(`/api/automation/rules/${ruleId}/run`)
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const userInfo = env.masterDatabase.getUserRegistryInfo(env.authId);
    expect(userInfo.last_seen_at).not.toBe('2026-06-01 00:00:00');
    expect(userInfo.last_seen_at >= CUTOFF_30D).toBe(true);
  });
});
