/**
 * Speed history schema
 * Stores per-poll speed samples for active torrents only
 * Samples are aggregated into hourly averages for condition evaluation
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS speed_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      torrent_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_downloaded INTEGER NOT NULL,
      total_uploaded INTEGER NOT NULL,
      FOREIGN KEY (torrent_id) REFERENCES torrent_shadow (torrent_id) ON DELETE CASCADE
    )
  `).run();

  // Index for efficient time-based queries and pruning
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_speed_history_torrent_timestamp 
    ON speed_history(torrent_id, timestamp)
  `).run();

  // Index for timestamp-based pruning
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_speed_history_timestamp 
    ON speed_history(timestamp)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_speed_history_timestamp').run();
  db.prepare('DROP INDEX IF EXISTS idx_speed_history_torrent_timestamp').run();
  db.prepare('DROP TABLE IF EXISTS speed_history').run();
};

