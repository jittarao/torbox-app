/**
 * Track whether a TorBox create attempt was served from cache (excluded from uncached hourly limit).
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(upload_attempts)').all();
  if (!tableInfo.some((col) => col.name === 'is_cached')) {
    db.prepare('ALTER TABLE upload_attempts ADD COLUMN is_cached INTEGER NOT NULL DEFAULT 0').run();
  }

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_uncached_type_time
    ON upload_attempts(type, attempted_at)
    WHERE is_cached = 0
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_uncached_type_time').run();
  // SQLite cannot drop columns easily; leave is_cached in place on rollback.
};
