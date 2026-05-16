import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import StateDiffEngine from '../StateDiffEngine.js';

function makeDownloadingTorrent(id, downloaded = 0, uploaded = 0) {
  return {
    id,
    active: true,
    download_finished: false,
    download_present: false,
    total_downloaded: downloaded,
    total_uploaded: uploaded,
  };
}

describe('StateDiffEngine', () => {
  let db;
  let engine;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE torrent_shadow (
        torrent_id TEXT PRIMARY KEY,
        last_total_downloaded INTEGER DEFAULT 0,
        last_total_uploaded INTEGER DEFAULT 0,
        last_state TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    engine = new StateDiffEngine(db);
  });

  it('detects new torrents and inserts shadow rows', async () => {
    const t = makeDownloadingTorrent(101, 10, 2);
    const changes = await engine.processSnapshot([t]);

    expect(changes.new.length).toBe(1);
    expect(changes.updated.length).toBe(0);
    expect(changes.removed.length).toBe(0);

    const row = db.prepare('SELECT * FROM torrent_shadow WHERE torrent_id = ?').get('101');
    expect(row).toBeTruthy();
    expect(row.last_total_downloaded).toBe(10);
    expect(row.last_state).toBe('downloading');
  });

  it('detects byte/state updates for existing shadow rows', async () => {
    await engine.processSnapshot([makeDownloadingTorrent(7, 100, 5)]);

    const changes = await engine.processSnapshot([makeDownloadingTorrent(7, 200, 5)]);

    expect(changes.updated.length).toBe(1);
    expect(changes.updated[0].diff.hasChanges).toBe(true);
    expect(changes.updated[0].diff.downloadChanged).toBe(true);

    const row = db.prepare('SELECT last_total_downloaded FROM torrent_shadow WHERE torrent_id = ?').get('7');
    expect(row.last_total_downloaded).toBe(200);
  });

  it('marks removed torrents and deletes shadow', async () => {
    await engine.processSnapshot([makeDownloadingTorrent(1, 0, 0)]);

    const changes = await engine.processSnapshot([]);

    expect(changes.removed.length).toBe(1);
    const row = db.prepare('SELECT * FROM torrent_shadow WHERE torrent_id = ?').get('1');
    expect(row == null).toBe(true);
  });
});
