import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import request from 'supertest';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
  buildBackendApp,
  createMockPollingScheduler,
} from './helpers/backendTestHelper.js';
import { setupAutomationRoutes } from '../automation.js';

const OTHER_API_KEY = 'tb-test-api-key-fedcba9876543210fedcba9876543210';

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

async function insertTag(env, authId, name) {
  const conn = await env.userDatabaseManager.getUserDatabase(authId);
  try {
    return Number(conn.db.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid);
  } finally {
    env.userDatabaseManager.releaseConnection(authId);
  }
}

async function tagNamesFor(env, authId) {
  const conn = await env.userDatabaseManager.getUserDatabase(authId);
  try {
    return conn.db.prepare('SELECT id, name FROM tags ORDER BY name').all();
  } finally {
    env.userDatabaseManager.releaseConnection(authId);
  }
}

describe('automation rule export/import routes', () => {
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

  async function seedTaggedRules(key = env.apiKey, authId = env.authId) {
    const doneId = await insertTag(env, authId, 'Done');
    await insertTag(env, authId, 'Unused');
    await request(app)
      .post('/api/automation/rules')
      .set('x-api-key', key)
      .send({
        rules: [
          makeRule({ name: 'Archive old' }),
          makeRule({ name: 'Tag done', action: { type: 'add_tag', tagIds: [doneId] } }),
        ],
      })
      .expect(200);
    return doneId;
  }

  test('GET /export returns portable rules and only referenced tags', async () => {
    const doneId = await seedTaggedRules();

    const res = await request(app)
      .get('/api/automation/rules/export')
      .set('x-api-key', env.apiKey)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data.format).toBe('torbox-manager.automation-rules');
    expect(data.version).toBe(1);
    expect(data.rules).toHaveLength(2);
    for (const rule of data.rules) {
      expect(rule.id).toBeUndefined();
      expect(rule.execution_count).toBeUndefined();
      expect(rule.metadata).toBeUndefined();
    }
    expect(data.tags).toEqual([{ id: doneId, name: 'Done' }]);
  });

  test('export from one API key imports into another with tags recreated', async () => {
    await seedTaggedRules();
    const exported = (
      await request(app).get('/api/automation/rules/export').set('x-api-key', env.apiKey).send()
    ).body.data;

    const { authId: otherAuthId } = await env.masterDatabase.registerApiKey(OTHER_API_KEY, 'other');
    await insertTag(env, otherAuthId, 'Filler'); // shift ids so remapping is observable

    const res = await request(app)
      .post('/api/automation/rules/import')
      .set('x-api-key', OTHER_API_KEY)
      .send({ data: exported });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.importedRules).toHaveLength(2);
    expect(res.body.skipped).toEqual([]);
    expect(res.body.createdTagCount).toBe(1);

    const otherTags = await tagNamesFor(env, otherAuthId);
    const newDone = otherTags.find((t) => t.name === 'Done');
    const tagRule = res.body.importedRules.find((r) => r.name === 'Tag done');
    expect(tagRule.action.tagIds).toEqual([newDone.id]);
  });

  test('import appends to existing rules and skips duplicate names', async () => {
    await seedTaggedRules();
    const exported = (
      await request(app).get('/api/automation/rules/export').set('x-api-key', env.apiKey).send()
    ).body.data;
    exported.rules.push(makeRule({ name: 'Brand new' }));

    const res = await request(app)
      .post('/api/automation/rules/import')
      .set('x-api-key', env.apiKey)
      .send({ data: exported });

    expect(res.status).toBe(200);
    expect(res.body.importedRules.map((r) => r.name)).toEqual(['Brand new']);
    expect(res.body.skipped.map((s) => s.reason)).toEqual(['duplicate', 'duplicate']);
    expect(res.body.createdTagCount).toBe(0);

    const list = await request(app)
      .get('/api/automation/rules')
      .set('x-api-key', env.apiKey)
      .send();
    expect(list.body.rules).toHaveLength(3);
  });

  test('import skips rules that fail validation or reference unknown tags', async () => {
    const res = await request(app)
      .post('/api/automation/rules/import')
      .set('x-api-key', env.apiKey)
      .send({
        data: {
          format: 'torbox-manager.automation-rules',
          version: 1,
          rules: [
            makeRule({ name: 'Good' }),
            makeRule({ name: 'Bad action', action: { type: 'explode' } }),
            makeRule({ name: 'Orphan tag', action: { type: 'add_tag', tagIds: [42] } }),
          ],
          tags: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.importedRules.map((r) => r.name)).toEqual(['Good']);
    expect(res.body.skipped).toEqual([
      expect.objectContaining({ index: 1, name: 'Bad action', reason: 'invalid' }),
      expect.objectContaining({ index: 2, name: 'Orphan tag', reason: 'missing_tags' }),
    ]);
  });

  test('import rejects a file that is not a rules export', async () => {
    const res = await request(app)
      .post('/api/automation/rules/import')
      .set('x-api-key', env.apiKey)
      .send({ data: { hello: 'world' } });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_RULES_EXPORT');
  });
});
