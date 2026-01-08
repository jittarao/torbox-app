/**
 * Torrent shadow state schema
 * Stores the last seen state of each torrent for diff computation
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS torrent_shadow (
      torrent_id TEXT PRIMARY KEY,
      last_total_downloaded INTEGER DEFAULT 0,
      last_total_uploaded INTEGER DEFAULT 0,
      last_state TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS torrent_shadow').run();
};

