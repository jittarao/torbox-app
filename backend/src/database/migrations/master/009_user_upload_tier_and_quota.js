/**
 * Add upload tier and retained-file quota counters to user_registry.
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(user_registry)').all();
  const columnNames = new Set(tableInfo.map((col) => col.name));

  if (!columnNames.has('upload_tier')) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN upload_tier TEXT NOT NULL DEFAULT 'limited'
    `
    ).run();
  }

  if (!columnNames.has('upload_retained_file_count')) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN upload_retained_file_count INTEGER DEFAULT 0
    `
    ).run();
  }

  if (!columnNames.has('upload_retained_storage_bytes')) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN upload_retained_storage_bytes INTEGER DEFAULT 0
    `
    ).run();
  }

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_user_registry_upload_tier
    ON user_registry(upload_tier)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_user_registry_upload_tier').run();
};
