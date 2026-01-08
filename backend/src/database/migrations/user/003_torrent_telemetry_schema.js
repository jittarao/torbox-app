/**
 * Torrent telemetry schema
 * Stores derived fields computed from state diffs
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS torrent_telemetry (
      torrent_id TEXT PRIMARY KEY,
      last_download_activity_at DATETIME,
      last_upload_activity_at DATETIME,
      stalled_since DATETIME,
      upload_stalled_since DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (torrent_id) REFERENCES torrent_shadow (torrent_id) ON DELETE CASCADE
    )
  `).run();

  // Indexes for time-based queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_torrent_telemetry_stalled_since 
    ON torrent_telemetry(stalled_since)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_torrent_telemetry_stalled_since').run();
  db.prepare('DROP TABLE IF EXISTS torrent_telemetry').run();
};
