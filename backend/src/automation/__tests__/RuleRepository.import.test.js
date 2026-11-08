import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  createBackendTestEnv,
  cleanupBackendTestEnv,
} from '../../routes/__tests__/helpers/backendTestHelper.js';
import RuleRepository from '../helpers/RuleRepository.js';

function portableRule(overrides = {}) {
  return {
    name: 'Imported',
    enabled: true,
    assetTypes: ['torrent'],
    trigger: { type: 'interval', value: 60 },
    logicOperator: 'and',
    groups: [{ logicOperator: 'and', conditions: [] }],
    action: { type: 'archive' },
    ...overrides,
  };
}

describe('RuleRepository.importRules', () => {
  let env;
  let conn;
  let repo;

  beforeEach(async () => {
    env = await createBackendTestEnv();
    conn = await env.userDatabaseManager.getUserDatabase(env.authId);
    repo = new RuleRepository(env.authId, () => Promise.resolve(conn.db));
  });

  afterEach(() => {
    env.userDatabaseManager.releaseConnection(env.authId);
    cleanupBackendTestEnv(env);
  });

  test('appends rules, reuses tags case-insensitively, and creates missing tags', async () => {
    await repo.saveRules([portableRule({ name: 'Existing' })]);
    const moviesId = Number(
      conn.db.prepare('INSERT INTO tags (name) VALUES (?)').run('Movies').lastInsertRowid
    );

    const { savedRules, createdTagCount } = await repo.importRules(
      [
        portableRule({ name: 'Tag movies', action: { type: 'add_tag', tagIds: [7] } }),
        portableRule({
          name: 'Seen filter',
          groups: [
            {
              logicOperator: 'and',
              conditions: [{ type: 'TAGS', operator: 'is_any_of', value: [9] }],
            },
          ],
        }),
      ],
      new Map([
        [7, 'movies'],
        [9, 'Seen'],
      ])
    );

    expect(createdTagCount).toBe(1);
    const seenId = conn.db.prepare('SELECT id FROM tags WHERE name = ?').get('Seen').id;

    expect(savedRules.map((r) => r.name)).toEqual(['Tag movies', 'Seen filter']);
    expect(savedRules[0].action.tagIds).toEqual([moviesId]);
    expect(savedRules[1].groups[0].conditions[0].value).toEqual([seenId]);

    const all = await repo.getRules();
    expect(all.map((r) => r.name).sort()).toEqual(['Existing', 'Seen filter', 'Tag movies']);
  });

  test('rolls back tags and rules when an insert fails', async () => {
    await expect(
      repo.importRules(
        [
          portableRule({ name: 'ok', action: { type: 'add_tag', tagIds: [1] } }),
          portableRule({ name: null }),
        ],
        new Map([[1, 'Rollback']])
      )
    ).rejects.toThrow();

    expect(conn.db.prepare('SELECT COUNT(*) AS n FROM tags').get().n).toBe(0);
    expect(await repo.getRules()).toEqual([]);
  });
});
