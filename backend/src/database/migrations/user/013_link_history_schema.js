/**
 * Link history schema
 * Stores generated download links (torrents, usenet, webdl) for user reference
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS link_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      file_id TEXT,
      url TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      item_name TEXT,
      file_name TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Index for efficient lookups by item_id, file_id, and asset_type
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_link_history_item_file 
    ON link_history(item_id, file_id, asset_type)
  `
  ).run();

  // Index for pagination queries (most recent first)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_link_history_generated_at 
    ON link_history(generated_at DESC)
  `
  ).run();

  // Index for efficient lookups by item_id (for highlighting downloads)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_link_history_item_id 
    ON link_history(item_id)
  `
  ).run();

  // Index for search on item_name
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_link_history_item_name 
    ON link_history(item_name)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_link_history_item_name').run();
  db.prepare('DROP INDEX IF EXISTS idx_link_history_item_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_link_history_generated_at').run();
  db.prepare('DROP INDEX IF EXISTS idx_link_history_item_file').run();
  db.prepare('DROP TABLE IF EXISTS link_history').run();
};
