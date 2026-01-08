/**
 * Migration table creation
 * This migration creates the schema_migrations table to track applied migrations
 * This should always be the first migration (000)
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create index for faster lookups
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
    ON schema_migrations(version)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS schema_migrations').run();
};

