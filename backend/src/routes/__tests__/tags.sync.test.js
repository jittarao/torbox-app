import { up as removals } from '../../database/migrations/user/028_torbox_tag_push_removals.js';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import axios from 'axios';
import { setupTagsRoutes } from '../tags.js';
import { setupDownloadTagsRoutes } from '../downloadTags.js';
import { up as tags } from '../../database/migrations/user/007_tags_schema.js';
import { up as assignments } from '../../database/migrations/user/008_download_tags_schema.js';
import { up as pending } from '../../database/migrations/user/027_torbox_tag_sync_pending.js';
import { queueTagPush, tagSyncClient } from '../../utils/torboxTagSync.js';

let db, routes, backend, calls, adapter, req, remoteTags;
beforeEach(() => {
  db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  tags(db);
  assignments(db);
  pending(db);
  removals(db);
  routes = new Map();
  const app = Object.fromEntries(
    ['get', 'post', 'put', 'delete'].map((method) => [
      method,
      (path, ...handlers) => routes.set(`${method} ${path}`, handlers),
    ])
  );
  backend = {
    requireRegisteredUser: () => {},
    userRateLimiter: () => {},
    userDatabaseManager: { getUserDatabase: async () => ({ db }), releaseConnection: () => {} },
  };
  setupTagsRoutes(app, backend);
  setupDownloadTagsRoutes(app, backend);
  req = {
    validatedAuthId: 'test',
    headers: { 'x-api-key': crypto.randomUUID() },
    query: { sync: 'true' },
    body: {},
    validatedIds: { id: 1 },
    params: { id: '1' },
  };
  calls = [];
  remoteTags = new Map();
  adapter = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    calls.push(config);
    if (config.method === 'put') {
      const body = JSON.parse(config.data);
      remoteTags.set(String(body.torrent_id), body.tags);
    }
    return {
      status: 200,
      headers: {},
      config,
      data: {
        success: true,
        data:
          config.method === 'get' && config.url === '/api/torrents/mylist'
            ? {
                id: config.params.id,
                name: 'Download',
                tags: remoteTags.get(String(config.params.id)) || [],
              }
            : null,
      },
    };
  };
});
afterEach(() => {
  axios.defaults.adapter = adapter;
  db.close();
});
async function invoke(route) {
  const handlers = routes.get(route);
  expect(handlers[0]).toBe(backend.requireRegisteredUser);
  expect(handlers).toContain(backend.userRateLimiter);
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await handlers.at(-1)(req, res);
  return res;
}
async function drain() {
  await queueTagPush(db, tagSyncClient(req), []);
}

test('all tag GET routes serve local data with zero upstream requests, even with sync=true', async () => {
  db.prepare('INSERT INTO tags (name) VALUES (?)').run('Local');
  db.prepare('INSERT INTO download_tags (tag_id, download_id) VALUES (1, ?)').run('7');
  for (const route of ['get /api/tags', 'get /api/tags/:id', 'get /api/downloads/tags']) {
    expect((await invoke(route)).statusCode).toBe(200);
  }
  expect(calls).toHaveLength(0);
  expect(db.prepare('SELECT * FROM download_tags').all()).toHaveLength(1);
});

test('manual add/replace/remove routes push only the affected ID after saving locally', async () => {
  db.prepare('INSERT INTO tags (name) VALUES (?)').run('Local');
  for (const operation of ['add', 'replace', 'remove']) {
    req.body = { download_ids: [7], tag_ids: [1], operation };
    expect((await invoke('post /api/downloads/tags')).statusCode).toBe(200);
    await drain();
    expect(JSON.parse(calls.filter((c) => c.method === 'put').at(-1).data).tags).toEqual(
      operation === 'remove' ? [] : ['Local']
    );
  }
  expect(calls.filter((c) => c.method === 'get').every((c) => c.params.id === '7')).toBe(true);
});

test('rename and delete use local assignments, including deletion of the last tag', async () => {
  db.prepare('INSERT INTO tags (name) VALUES (?)').run('Local');
  db.prepare('INSERT INTO download_tags (tag_id, download_id) VALUES (1, ?)').run('7');
  req.body = { name: 'Renamed' };
  await invoke('put /api/tags/:id');
  await drain();
  expect(JSON.parse(calls.filter((c) => c.method === 'put').at(-1).data).tags).toEqual(['Renamed']);
  await invoke('delete /api/tags/:id');
  await drain();
  expect(JSON.parse(calls.filter((c) => c.method === 'put').at(-1).data).tags).toEqual([]);
  expect(db.prepare('SELECT download_id FROM torbox_tag_sync_pending').all()).toEqual([
    { download_id: '7' },
  ]);
});

test('explicit first sync responds 202 before upstream completion and retries removed-tag IDs', async () => {
  db.prepare('INSERT INTO tags (name) VALUES (?)').run('Local');
  db.prepare('INSERT INTO download_tags (tag_id, download_id) VALUES (1, ?)').run('7');
  db.prepare('INSERT INTO torbox_tag_sync_pending (download_id, removed_names) VALUES (?, ?)').run(
    '8',
    '["Removed"]'
  );
  remoteTags.set('8', ['Removed']);
  let release;
  const blocked = new Promise((r) => {
    release = r;
  });
  const original = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    await blocked;
    return original(config);
  };
  const res = await invoke('post /api/tags/sync');
  expect(res.statusCode).toBe(202);
  expect(res.body.running).toBe(true);
  expect(calls).toHaveLength(0);
  release();
  await drain();
  expect(calls.filter((c) => c.method === 'put').map((c) => JSON.parse(c.data).tags)).toEqual([
    ['Local'],
    [],
  ]);
  expect((await invoke('get /api/tags/sync')).body).toEqual({
    success: true,
    running: false,
    completed: 2,
    failed: 0,
  });
});

test('explicit sync requires an API key even when legacy local access is authorized', async () => {
  req.headers = {};
  const res = await invoke('post /api/tags/sync');
  expect(res.statusCode).toBe(401);
  expect(calls).toHaveLength(0);
});
