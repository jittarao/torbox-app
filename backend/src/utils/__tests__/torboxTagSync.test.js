import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { up as createTags } from '../../database/migrations/user/007_tags_schema.js';
import { up as createAssignments } from '../../database/migrations/user/008_download_tags_schema.js';
import { up as createSyncState } from '../../database/migrations/user/026_torbox_tag_sync.js';
import { up as createPending } from '../../database/migrations/user/027_torbox_tag_sync_pending.js';
import { editTags, importAssignments, listDownloads, shouldSkipTagSync, tagSyncRetryDelayMs } from '../torboxTagSync.js';

function database() {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  createTags(db);
  createAssignments(db);
  createSyncState(db);
  createPending(db);
  return db;
}

describe('TorBox tag import', () => {
  test('imports remote tags and removes an externally deleted tag without deleting a download', () => {
    const db = database();
    try {
      importAssignments(db, [{ id: 7, tags: ['Movies', 'Keep'] }], false);
      expect(db.prepare('SELECT name FROM tags ORDER BY name').all().map((row) => row.name)).toEqual(['Keep', 'Movies']);

      importAssignments(db, [{ id: 7, tags: ['Keep'] }], true);
      expect(db.prepare('SELECT name FROM tags ORDER BY name').all().map((row) => row.name)).toEqual(['Keep']);
      expect(db.prepare('SELECT t.name FROM download_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.download_id = ?').all('7').map((row) => row.name)).toEqual(['Keep']);
    } finally {
      db.close();
    }
  });

  test('keeps a new, unassigned TBM tag until it is assigned', () => {
    const db = database();
    try {
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('Later');
      importAssignments(db, [{ id: 8, tags: [] }], false);
      expect(db.prepare('SELECT name FROM tags').all().map((row) => row.name)).toEqual(['Later']);
    } finally {
      db.close();
    }
  });

  test('preserves a local assignment when TorBox rejects a tag edit', () => {
    const db = database();
    try {
      const tagId = db.prepare('INSERT INTO tags (name) VALUES (?)').run('Local').lastInsertRowid;
      db.prepare('INSERT INTO download_tags (tag_id, download_id) VALUES (?, ?)').run(tagId, '8');
      importAssignments(db, [{ id: 8, tags: [] }], false, {
        skipIds: new Set(['8']),
        pendingUpdates: [{ downloadId: '8', lastName: 'A' }],
      });
      expect(db.prepare('SELECT tag_id FROM download_tags WHERE download_id = ?').all('8')).toHaveLength(1);
      expect(db.prepare('SELECT last_name FROM torbox_tag_sync_pending WHERE download_id = ?').get('8').last_name).toBe('A');

      importAssignments(db, [{ id: 8, tags: ['Local'] }], true, { pendingDeletes: ['8'] });
      expect(db.prepare('SELECT download_id FROM torbox_tag_sync_pending').all()).toEqual([]);
      expect(db.prepare('SELECT tag_id FROM download_tags WHERE download_id = ?').all('8')).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});

test('tag edit preserves the other TorBox item fields', async () => {
  const calls = [];
  const client = { client: { put: async (endpoint, body) => {
    calls.push({ endpoint, body });
    return { data: { success: true } };
  } } };
  const item = {
    id: 9,
    name: 'Original name',
    tags: ['Old'],
    alternative_hashes: ['0123456789abcdef0123456789abcdef'],
    airlocked: true,
    _tagSyncType: {
      edit: '/api/torrents/edittorrent',
      idField: 'torrent_id',
    },
  };

  await editTags(client, item, ['New']);
  expect(calls).toEqual([{ endpoint: '/api/torrents/edittorrent', body: {
    torrent_id: 9,
    name: 'Original name',
    tags: ['New'],
    alternative_hashes: ['0123456789abcdef0123456789abcdef'],
    airlocked: true,
  } }]);
  expect(item.tags).toEqual(['New']);
});

test.each(['A', undefined])('WebDL tag edit omits invalid name %p and preserves other fields', async (name) => {
  const calls = [];
  const client = { client: { put: async (endpoint, body) => {
    calls.push({ endpoint, body });
    return { data: { success: true } };
  } } };
  const item = {
    id: 8,
    name,
    tags: [],
    alternative_hashes: ['0123456789abcdef0123456789abcdef'],
    airlocked: false,
    _tagSyncType: { edit: '/api/webdl/editwebdownload', idField: 'webdl_id' },
  };
  await editTags(client, item, ['Local']);
  expect(calls).toEqual([{ endpoint: '/api/webdl/editwebdownload', body: {
    webdl_id: 8,
    tags: ['Local'],
    alternative_hashes: ['0123456789abcdef0123456789abcdef'],
    airlocked: false,
  } }]);
  expect(item.name).toBe(name);
  expect(item.tags).toEqual(['Local']);
});

test('429 cooldown honors TorBox retry headers and has a fallback', () => {
  const now = 1_000_000;
  expect(tagSyncRetryDelayMs({ response: { status: 429, headers: {} } }, now)).toBe(120_000);
  expect(tagSyncRetryDelayMs({ response: { status: 429, headers: { 'retry-after': '180' } } }, now)).toBe(180_000);
  expect(tagSyncRetryDelayMs({ response: { status: 429, headers: { 'x-ratelimit-reset': '240' } } }, now)).toBe(240_000);
  expect(tagSyncRetryDelayMs(new Error('temporary'), now)).toBe(60_000);
});

test('list failure identifies the TorBox endpoint without an API request in the test', async () => {
  const client = { client: { get: async (endpoint) => {
    if (endpoint === '/api/usenet/mylist') {
      const error = new Error('Request failed with status code 500');
      error.response = { status: 500 };
      throw error;
    }
    return { data: { success: true, data: [] } };
  } } };
  try {
    await listDownloads(client);
    throw new Error('Expected listDownloads to reject');
  } catch (error) {
    expect(error.tagSyncEndpoint).toBe('/api/usenet/mylist');
    expect(error.response.status).toBe(500);
  }
});

test('tag sync rejects a TorBox list response marked unsuccessful', async () => {
  const client = { client: { get: async () => ({
    data: { success: false, error: 'TEMPORARY_ERROR', data: null },
  }) } };
  try {
    await listDownloads(client);
    throw new Error('Expected listDownloads to reject');
  } catch (error) {
    expect(error.message).toBe('TEMPORARY_ERROR');
    expect(error.tagSyncEndpoint).toBe('/api/torrents/mylist');
  }
});

test('manual sync refreshes cached tags but respects retry cooldown and in-flight requests', () => {
  const now = 100_000;
  const fresh = { nextAt: now + 60_000, attemptedAt: now - 20_000, canForce: true };
  expect(shouldSkipTagSync(fresh, false, now)).toBe(true);
  expect(shouldSkipTagSync(fresh, true, now)).toBe(false);
  expect(shouldSkipTagSync({ ...fresh, attemptedAt: now - 5_000 }, true, now)).toBe(true);
  expect(shouldSkipTagSync({ ...fresh, canForce: false }, true, now)).toBe(true);
  expect(shouldSkipTagSync({ ...fresh, pending: true }, true, now)).toBe(true);
});
