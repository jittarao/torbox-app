/**
 * Hourly create budget now includes Found Cached responses (TorBox still enforces
 * the 60/hour cap against them in practice). Index successful attempts by type/time
 * instead of the old is_cached=0 partial index.
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
