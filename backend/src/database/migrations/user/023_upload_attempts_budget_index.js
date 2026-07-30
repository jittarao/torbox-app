/**
 * Index successful upload_attempts by type/time for the durable rolling-hour
 * uncached create budget (is_cached = 0 counted in application SQL; this index
 * covers success rows so both uncached-budget and legacy scans stay cheap).
 * Replaces the old is_cached=0 partial index.
 */
export const up = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_uncached_type_time').run();
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_budget_type_time
    ON upload_attempts(type, attempted_at)
    WHERE success = 1
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_budget_type_time').run();
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_uncached_type_time
    ON upload_attempts(type, attempted_at)
    WHERE is_cached = 0
  `
  ).run();
};
