import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { up as archivedDownloadsUp } from '../../database/migrations/user/005_archived_downloads_schema.js';
import { up as uniqueTorrentUp } from '../../database/migrations/user/014_unique_archived_downloads.js';
import { bulkArchiveDownloadsInDb } from '../archivedDownloads.js';

function createTestDb() {
  const db = new Database(':memory:');
  archivedDownloadsUp(db);
  uniqueTorrentUp(db);
  return db;
}

describe('bulkArchiveDownloadsInDb', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts new torrents and returns their ids', () => {
    const torrentIds = bulkArchiveDownloadsInDb(db, [
      { torrent_id: '1', hash: 'aaa', name: 'One', tracker: 'http://t.example' },
      { torrent_id: '2', hash: 'bbb', name: 'Two' },
    ]);

    expect(torrentIds.sort()).toEqual(['1', '2']);

    const count = db.prepare('SELECT COUNT(*) as c FROM archived_downloads').get();
    expect(count.c).toBe(2);
  });

  it('returns id for already-archived torrent without duplicating rows', () => {
    bulkArchiveDownloadsInDb(db, [{ torrent_id: '1', hash: 'aaa', name: 'One' }]);

    const torrentIds = bulkArchiveDownloadsInDb(db, [
      { torrent_id: '1', hash: 'aaa', name: 'One' },
      { torrent_id: '2', hash: 'bbb', name: 'Two' },
    ]);

    expect(torrentIds.sort()).toEqual(['1', '2']);

    const count = db.prepare('SELECT COUNT(*) as c FROM archived_downloads').get();
    expect(count.c).toBe(2);
  });

  it('skips invalid entries when called with only valid rows', () => {
    const torrentIds = bulkArchiveDownloadsInDb(db, [
      { torrent_id: '1', hash: 'aaa' },
    ]);

    expect(torrentIds).toEqual(['1']);
  });
});
