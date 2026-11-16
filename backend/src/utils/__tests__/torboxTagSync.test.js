import { up as removals } from '../../database/migrations/user/028_torbox_tag_push_removals.js';
import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { up as createTags } from '../../database/migrations/user/007_tags_schema.js';
import { up as createAssignments } from '../../database/migrations/user/008_download_tags_schema.js';
import { up as createPending } from '../../database/migrations/user/027_torbox_tag_sync_pending.js';
import { editTags, tagNames, pushDownloadTags, queueTagPush } from '../torboxTagSync.js';
import RuleEvaluator from '../../automation/RuleEvaluator.js';

export function database() {
  const db = new Database(':memory:');
  createTags(db);
  createAssignments(db);
  createPending(db);
  removals(db);
  return db;
}
let sequence = 0;
function client(items = {}) {
  const calls = [];
  return {
    apiKey: `test-${++sequence}`,
    authId: 'test',
    calls,
    handleApiCall: async (fn, options) => {
      calls.push(options);
      return fn();
    },
    client: {
      get: async (endpoint, config) => {
        calls.push({ endpoint, config });
        return { data: { success: true, data: items[endpoint]?.[config.params.id] || null } };
      },
      put: async (endpoint, body) => {
        calls.push({ endpoint, body });
        return { data: { success: true } };
      },
    },
  };
}
function assign(db, id, name) {
  const tagId = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid;
  db.prepare('INSERT INTO download_tags (tag_id, download_id) VALUES (?, ?)').run(
    tagId,
    String(id)
  );
  return Number(tagId);
}

test('normalizes strings and mylist tag objects without losing names', () => {
  expect(tagNames([' Local ', { id: 1, name: 'Remote' }, { name: 'local' }, null])).toEqual([
    'Local',
    'Remote',
  ]);
});

describe('safe edit payloads', () => {
  test.each([true, 1, 'true', false, 0, 'false'])(
    'preserves airlock %p and hashes',
    async (airlocked) => {
      const api = client();
      await editTags(
        api,
        {
          id: 9,
          name: 'Original name',
          airlocked,
          alternative_hashes: ['abc'],
          _tagSyncType: { edit: '/api/usenet/editusenetdownload', idField: 'usenet_download_id' },
        },
        ['New']
      );
      expect(api.calls.at(-1).body).toEqual({
        usenet_download_id: 9,
        name: 'Original name',
        tags: ['New'],
        alternative_hashes: ['abc'],
        airlocked: [true, 1, 'true'].includes(airlocked),
      });
      expect(api.calls[0].operation).toBe('updating tags');
    }
  );
  test.each(['A', undefined])('omits missing/short name %p and absent fields', async (name) => {
    const api = client();
    await editTags(api, { id: 8, name, _tagSyncType: { edit: '/edit', idField: 'webdl_id' } }, [
      'Local',
    ]);
    expect(api.calls.at(-1).body).toEqual({ webdl_id: 8, tags: ['Local'] });
  });
});

test('fetches only affected IDs using request controls; handles object mylist response', async () => {
  const api = client({ '/api/torrents/mylist': { 7: { id: 7, tags: [{ name: 'Remote' }] } } });
  await pushDownloadTags(api, '7', ['Local']);
  const gets = api.calls.filter((c) => c.config);
  expect(gets).toHaveLength(1);
  expect(gets.every((c) => c.config.params.id === '7' && !('offset' in c.config.params))).toBe(
    true
  );
  expect(api.calls.filter((c) => c.semaphore === 'fetch')).toHaveLength(1);
  expect(api.calls.find((c) => c.body).body.tags).toEqual(['Remote', 'Local']);
});

test('queued/archived items and empty tags keep stable local definitions and mappings', async () => {
  const db = database();
  try {
    const id = assign(db, 7, 'Queued');
    db.prepare('INSERT INTO tags (name) VALUES (?)').run('Empty');
    const api = client();
    await queueTagPush(db, api, [7]);
    expect(db.prepare('SELECT id FROM tags WHERE name = ?').get('Queued').id).toBe(id);
    expect(db.prepare('SELECT * FROM tags').all()).toHaveLength(2);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(1);
    expect(db.prepare('SELECT download_id FROM torbox_tag_sync_pending').all()).toEqual([
      { download_id: '7' },
    ]);
    expect(api.calls.some((c) => c.body)).toBe(false);
  } finally {
    db.close();
  }
});

test('automation add and remove push local state and survive subsequent pushes', async () => {
  const db = database();
  try {
    const id = Number(
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('Rule tag').lastInsertRowid
    );
    const api = client({
      '/api/torrents/mylist': { 7: { id: 7, name: 'Download', tags: [] } },
    });
    const originalPut = api.client.put;
    api.client.put = async (endpoint, body) => {
      api.client.get = async () => ({ data: { success: true, data: { id: 7, tags: body.tags } } });
      return originalPut(endpoint, body);
    };
    const evaluator = new RuleEvaluator(db, api);
    await evaluator.addTagsToDownload({ tagIds: [id] }, { id: 7 });
    await queueTagPush(db, api, [7]);
    expect(api.calls.filter((c) => c.body).at(-1).body.tags).toEqual(['Rule tag']);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(1);
    await evaluator.removeTagsFromDownload({ tagIds: [id] }, { id: 7 });
    await queueTagPush(db, api, [7]);
    expect(api.calls.filter((c) => c.body).at(-1).body.tags).toEqual([]);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(0);
    expect(db.prepare('SELECT * FROM tags').all()).toHaveLength(1);
  } finally {
    db.close();
  }
});

test('a failed first push does not block other items or erase local tags', async () => {
  const db = database();
  try {
    assign(db, 7, 'First');
    assign(db, 8, 'Second');
    const api = client({ '/api/torrents/mylist': { 7: { id: 7 }, 8: { id: 8 } } });
    const put = api.client.put;
    api.client.put = async (endpoint, body) => {
      if (body.torrent_id === 7)
        throw Object.assign(new Error('short name'), { code: 'NAME_TOO_SHORT' });
      return put(endpoint, body);
    };
    await queueTagPush(db, api, [7, 8]);
    expect(api.calls.find((c) => c.body)?.body.tags).toEqual(['Second']);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(2);
  } finally {
    db.close();
  }
});

test('serializes overlapping manual/automation/explicit pushes and ends with newest local state', async () => {
  const db = database();
  try {
    const tag = assign(db, 7, 'Before');
    const api = client({ '/api/torrents/mylist': { 7: { id: 7 } } });
    let release, entered;
    const blocked = new Promise((r) => {
      release = r;
    });
    const started = new Promise((r) => {
      entered = r;
    });
    const put = api.client.put;
    let first = true;
    api.client.put = async (...args) => {
      if (first) {
        first = false;
        entered();
        await blocked;
      }
      return put(...args);
    };
    const pending = queueTagPush(db, api, [7]);
    await started;
    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run('After', tag);
    const latest = queueTagPush(db, api, [7]);
    release();
    await Promise.all([pending, latest]);
    expect(api.calls.filter((c) => c.body).map((c) => c.body.tags)).toEqual([
      ['Before'],
      ['After'],
    ]);
  } finally {
    db.close();
  }
});

test('rate limits stop the batch and subsequent pushes honor cooldown', async () => {
  const db = database();
  try {
    assign(db, 7, 'Local');
    const api = client();
    let requests = 0;
    api.client.get = async () => {
      requests++;
      throw Object.assign(new Error('rate limited'), {
        response: { status: 429, headers: { 'retry-after': '180' } },
      });
    };
    await queueTagPush(db, api, [7, 8]);
    await queueTagPush(db, api, [7]);
    expect(requests).toBe(1);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(1);
    expect(db.prepare('SELECT * FROM torbox_tag_sync_pending').all()).toHaveLength(2);
  } finally {
    db.close();
  }
});

test('background push uses captured names after the request database closes', async () => {
  const db = database();
  assign(db, 7, 'Saved');
  const api = client({ '/api/torrents/mylist': { 7: { id: 7 } } });
  const job = queueTagPush(db, api, [7]);
  db.close();
  await job;
  expect(api.calls.find((c) => c.body).body.tags).toEqual(['Saved']);
});

test('failed removal remains durable and retries preserve unrelated remote tags', async () => {
  const db = database();
  try {
    const id = assign(db, 7, 'Remove');
    const previous = new Map([['7', ['Remove']]]);
    db.prepare('DELETE FROM download_tags WHERE tag_id = ?').run(id);
    const api = client({
      '/api/torrents/mylist': { 7: { id: 7, tags: [{ name: 'Remote only' }, { name: 'Remove' }] } },
    });
    const put = api.client.put;
    api.client.put = async () => {
      throw new Error('temporary');
    };
    await queueTagPush(db, api, [7], previous);
    expect(
      JSON.parse(
        db.prepare('SELECT removed_names FROM torbox_tag_sync_pending').get().removed_names
      )
    ).toEqual(['Remove']);
    api.client.put = put;
    // A new queue/client represents a restarted worker reading only durable state.
    api.apiKey = `restarted-${api.apiKey}`;
    await queueTagPush(db, api, [7]);
    expect(api.calls.filter((c) => c.body).at(-1).body.tags).toEqual(['Remote only']);
    expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(0);
  } finally {
    db.close();
  }
});
