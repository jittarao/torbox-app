/**
 * Archived downloads schema
 * Stores archived torrent information (id, hash, tracker) for later restoration
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS archived_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      torrent_id TEXT NOT NULL,
      hash TEXT NOT NULL,
      tracker TEXT,
      name TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Index for efficient lookups by torrent_id
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_archived_downloads_torrent_id 
    ON archived_downloads(torrent_id)
  `).run();

  // Index for efficient lookups by hash
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_archived_downloads_hash 
    ON archived_downloads(hash)
  `).run();

  // Index for pagination queries (most recent first)
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_archived_downloads_archived_at 
    ON archived_downloads(archived_at DESC)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_archived_downloads_archived_at').run();
  db.prepare('DROP INDEX IF EXISTS idx_archived_downloads_hash').run();
  db.prepare('DROP INDEX IF EXISTS idx_archived_downloads_torrent_id').run();
  db.prepare('DROP TABLE IF EXISTS archived_downloads').run();
};
