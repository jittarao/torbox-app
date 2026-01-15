/**
 * Add upload counters to user_registry table
 * Adds queued_uploads_count and next_upload_attempt_at columns for optimized upload processing
 * This migration is backward compatible with existing production databases
 */
export const up = (db) => {
  // Check if columns already exist (for idempotency)
  const tableInfo = db.prepare('PRAGMA table_info(user_registry)').all();
  const hasQueuedCount = tableInfo.some((col) => col.name === 'queued_uploads_count');
  const hasNextAttempt = tableInfo.some((col) => col.name === 'next_upload_attempt_at');

  // Add queued_uploads_count column if it doesn't exist
  if (!hasQueuedCount) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN queued_uploads_count INTEGER DEFAULT 0
    `
    ).run();
  }

  // Add next_upload_attempt_at column if it doesn't exist
  if (!hasNextAttempt) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN next_upload_attempt_at DATETIME
    `
    ).run();
  }

  // Create index for efficient upload processing queries
  // (idempotent - CREATE INDEX IF NOT EXISTS)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_user_registry_uploads 
    ON user_registry(queued_uploads_count, next_upload_attempt_at, status)
  `
  ).run();
};

export const down = (db) => {
  // SQLite doesn't support DROP COLUMN easily
  // We can only drop the index as a best-effort rollback
  db.prepare('DROP INDEX IF EXISTS idx_user_registry_uploads').run();

  // Note: Columns cannot be easily removed in SQLite without recreating the table
  // This is a limitation of SQLite's ALTER TABLE implementation
  // In practice, leaving the columns (with default values) is safe and doesn't cause issues
};
