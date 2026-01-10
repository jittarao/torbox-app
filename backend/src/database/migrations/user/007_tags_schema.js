/**
 * Tags schema
 * Creates the tags table for per-user databases
 * Stores user-defined tags for organizing downloads
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create index for name lookups (case-insensitive uniqueness handled in application layer)
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_tags_name 
    ON tags(name)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_tags_name').run();
  db.prepare('DROP TABLE IF EXISTS tags').run();
};
