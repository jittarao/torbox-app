import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { Database as SQLiteDatabase } from 'bun:sqlite';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import DatabaseMaster from '../../database/Database.js';
import UserDatabaseManager from '../../database/UserDatabaseManager.js';
import { up as createCustomViewsSchema } from '../../database/migrations/user/006_custom_views_schema.js';
import { up as addSortOrder } from '../../database/migrations/user/021_custom_views_sort_order.js';

const EMPTY_FILTERS = JSON.stringify({ groups: [], betweenGroups: 'and' });

describe('custom_views sort_order', () => {
  describe('migration backfill', () => {
    let db;

    beforeEach(() => {
      db = new SQLiteDatabase(':memory:');
      createCustomViewsSchema(db);
    });

    afterEach(() => {
      db?.close?.();
    });

    function insertView(name, createdAt) {
      const result = db
        .prepare(
          `INSERT INTO custom_views (name, filters, created_at, updated_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(name, EMPTY_FILTERS, createdAt, createdAt);
      return Number(result.lastInsertRowid);
    }

    test('preserves created_at DESC order as sort_order 0..n-1', () => {
      const oldestId = insertView('Oldest', '2024-01-01 00:00:00');
      const middleId = insertView('Middle', '2024-06-01 00:00:00');
      const newestId = insertView('Newest', '2024-12-01 00:00:00');

      addSortOrder(db);

      const ordered = db
        .prepare(
          `SELECT id, sort_order
           FROM custom_views
           ORDER BY sort_order ASC, id ASC`
        )
        .all();

      expect(ordered.map((row) => row.id)).toEqual([newestId, middleId, oldestId]);
      expect(ordered.map((row) => row.sort_order)).toEqual([0, 1, 2]);
    });
  });

  describe('runtime ordering', () => {
    let tempDir;
    let masterDatabase;
    let userDatabaseManager;
    let authId;
    let userDb;

    beforeEach(async () => {
      tempDir = path.join(process.cwd(), 'data', `test-custom-views-order-${Date.now()}`);
      mkdirSync(path.join(tempDir, 'users'), { recursive: true });
      process.env.MASTER_DB_PATH = path.join(tempDir, 'master.db');
      process.env.USER_DB_DIR = path.join(tempDir, 'users');

      masterDatabase = new DatabaseMaster();
      await masterDatabase.initialize();

      authId = 'test-auth-custom-views-order';
      const dbPath = path.join(tempDir, 'users', `user_${authId}.sqlite`);
      masterDatabase.runQuery(
        `INSERT INTO user_registry (auth_id, db_path, status, queued_uploads_count, next_upload_attempt_at)
         VALUES (?, ?, 'active', 0, datetime('now', '+1 day'))`,
        [authId, dbPath]
      );

      userDatabaseManager = new UserDatabaseManager(masterDatabase, path.join(tempDir, 'users'));
      userDb = await userDatabaseManager.getUserDatabase(authId);
    });

    afterEach(() => {
      userDatabaseManager?.releaseConnection?.(authId);
      masterDatabase?.close?.();
      rmSync(tempDir, { recursive: true, force: true });
      delete process.env.MASTER_DB_PATH;
      delete process.env.USER_DB_DIR;
    });

    function insertViewWithSortOrder(name, sortOrder, createdAt) {
      const result = userDb.db
        .prepare(
          `INSERT INTO custom_views (name, filters, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(name, EMPTY_FILTERS, sortOrder, createdAt, createdAt);
      return Number(result.lastInsertRowid);
    }

    function listViewsOrdered() {
      return userDb.db
        .prepare(
          `SELECT id, name, sort_order
           FROM custom_views
           ORDER BY sort_order ASC, id ASC`
        )
        .all();
    }

    function reorderViews(ids) {
      const update = userDb.db.prepare(
        `UPDATE custom_views
         SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      );
      userDb.db.transaction(() => {
        ids.forEach((id, index) => {
          update.run(index, id);
        });
      })();
    }

    test('new views append with increasing sort_order', () => {
      const firstId = insertViewWithSortOrder('First', 0, '2024-01-01 00:00:00');
      const secondId = insertViewWithSortOrder('Second', 1, '2024-02-01 00:00:00');

      const maxOrder = userDb.db
        .prepare('SELECT MAX(sort_order) as max_order FROM custom_views')
        .get();
      const nextOrder = (maxOrder?.max_order ?? -1) + 1;

      const result = userDb.db
        .prepare(
          `INSERT INTO custom_views (name, filters, sort_field, sort_direction, visible_columns, asset_type, search_query, sort_order)
           VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, ?)`
        )
        .run('Third', EMPTY_FILTERS, nextOrder);

      const thirdId = Number(result.lastInsertRowid);
      const ordered = listViewsOrdered();

      expect(ordered.map((row) => row.id)).toEqual([firstId, secondId, thirdId]);
      expect(ordered.map((row) => row.sort_order)).toEqual([0, 1, 2]);
    });

    test('batch reorder updates sort_order positions', () => {
      const a = insertViewWithSortOrder('A', 0, '2024-01-01 00:00:00');
      const b = insertViewWithSortOrder('B', 1, '2024-02-01 00:00:00');
      const c = insertViewWithSortOrder('C', 2, '2024-03-01 00:00:00');

      reorderViews([c, a, b]);

      const ordered = listViewsOrdered();
      expect(ordered.map((row) => row.name)).toEqual(['C', 'A', 'B']);
      expect(ordered.map((row) => row.sort_order)).toEqual([0, 1, 2]);
    });
  });
});
