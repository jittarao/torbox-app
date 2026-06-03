import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { up as archivedDownloadsUp } from '../../database/migrations/user/005_archived_downloads_schema.js';
import { up as uniqueTorrentUp } from '../../database/migrations/user/014_unique_archived_downloads.js';

function seedArchived(db) {
  db.prepare(
    `
    INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run('100', 'hash-alpha', 'http://tracker.one', 'Alpha Release');
  db.prepare(
    `
    INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  ).run('200', 'hash-beta', 'http://tracker.two', 'Beta Pack');
}

function searchArchived(db, search) {
  const searchParam = `%${search}%`;
  return db
    .prepare(
      `
    SELECT id, torrent_id, name
    FROM archived_downloads
    WHERE torrent_id LIKE ? OR name LIKE ? OR hash LIKE ? OR tracker LIKE ?
    ORDER BY archived_at DESC
  `
    )
    .all(searchParam, searchParam, searchParam, searchParam);
}

function bulkDeleteArchived(db, ids) {
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`DELETE FROM archived_downloads WHERE id IN (${placeholders})`).run(...ids);
}

describe('archived downloads search and bulk delete', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    archivedDownloadsUp(db);
    uniqueTorrentUp(db);
    seedArchived(db);
  });

  it('filters by torrent id, name, hash, or tracker', () => {
    expect(searchArchived(db, '100').map((r) => r.torrent_id)).toEqual(['100']);
    expect(searchArchived(db, 'Alpha').map((r) => r.name)).toEqual(['Alpha Release']);
    expect(searchArchived(db, 'hash-beta').map((r) => r.torrent_id)).toEqual(['200']);
    expect(searchArchived(db, 'tracker.two').map((r) => r.torrent_id)).toEqual(['200']);
  });

  it('bulk deletes by archive row ids', () => {
    const rows = db.prepare('SELECT id FROM archived_downloads ORDER BY id').all();
    const result = bulkDeleteArchived(
      db,
      rows.map((r) => r.id)
    );
    expect(result.changes).toBe(2);
    const count = db.prepare('SELECT COUNT(*) as c FROM archived_downloads').get();
    expect(count.c).toBe(0);
  });
});
