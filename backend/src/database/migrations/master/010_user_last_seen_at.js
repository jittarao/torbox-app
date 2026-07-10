/**
 * Add user activity timestamps to user_registry for engagement tracking.
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(user_registry)').all();
  const columnNames = new Set(tableInfo.map((col) => col.name));

  if (!columnNames.has('last_seen_at')) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN last_seen_at DATETIME NULL
    `
    ).run();
  }

  if (!columnNames.has('prev_last_seen_at')) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN prev_last_seen_at DATETIME NULL
    `
    ).run();
  }

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_user_registry_last_seen
    ON user_registry(last_seen_at)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_user_registry_created_at
    ON user_registry(created_at)
  `
  ).run();
};

// SQLite cannot DROP COLUMN without a table rebuild; down removes indexes only.
export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_user_registry_created_at').run();
  db.prepare('DROP INDEX IF EXISTS idx_user_registry_last_seen').run();
};
