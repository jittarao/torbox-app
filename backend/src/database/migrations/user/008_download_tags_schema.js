/**
 * Download tags schema
 * Creates the download_tags junction table for per-user databases
 * Maps downloads to tags (download IDs are unique across all asset types)
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS download_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL,
      download_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
      UNIQUE(tag_id, download_id)
    )
  `).run();

  // Index for efficient tag lookups
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_download_tags_tag_id 
    ON download_tags(tag_id)
  `).run();

  // Index for efficient download lookups
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_download_tags_download_id 
    ON download_tags(download_id)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_download_tags_download_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_download_tags_tag_id').run();
  db.prepare('DROP TABLE IF EXISTS download_tags').run();
};
