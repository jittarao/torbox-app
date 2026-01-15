/**
 * Upload attempts schema
 * Logs all TorBox API calls for rate limit tracking
 * This table persists even if uploads are deleted, ensuring accurate rate limit tracking
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS upload_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upload_id INTEGER,
      type TEXT NOT NULL,
      status_code INTEGER,
      success BOOLEAN NOT NULL,
      error_code TEXT,
      error_message TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Index for rate limit queries (by type and time window)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_type_time 
    ON upload_attempts(type, attempted_at)
  `
  ).run();

  // Index for upload_id lookups (optional, for debugging)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_upload_id 
    ON upload_attempts(upload_id)
  `
  ).run();

  // Index for cleanup queries (old attempts)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_upload_attempts_attempted_at 
    ON upload_attempts(attempted_at DESC)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_attempted_at').run();
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_upload_id').run();
  db.prepare('DROP INDEX IF EXISTS idx_upload_attempts_type_time').run();
  db.prepare('DROP TABLE IF EXISTS upload_attempts').run();
};
