/**
 * Uploads schema
 * Stores queued uploads (torrents, usenet, webdl) for background processing
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      upload_type TEXT NOT NULL,
      file_path TEXT,
      url TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      seed INTEGER,
      allow_zip BOOLEAN DEFAULT true,
      as_queued BOOLEAN DEFAULT false,
      password TEXT,
      queue_order INTEGER NOT NULL DEFAULT 0,
      next_attempt_at DATETIME,
      last_processed_at DATETIME,
      completed_at DATETIME,
      file_deleted BOOLEAN DEFAULT false,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  // Index for efficient status and type queries
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_uploads_status 
    ON uploads(status, type)
  `
  ).run();

  // Index for ordered processing (queued items by queue_order)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_uploads_queue_order 
    ON uploads(status, type, queue_order)
  `
  ).run();

  // Index for pagination queries (most recent first)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_uploads_created_at 
    ON uploads(created_at DESC)
  `
  ).run();

  // Index for efficient dequeuing (status + type + next_attempt_at + queue_order)
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_uploads_dequeue
    ON uploads(status, type, next_attempt_at, queue_order)
  `
  ).run();

  // Index for efficient queries filtering by file_deleted
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_uploads_file_deleted 
    ON uploads(file_deleted, completed_at)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_uploads_file_deleted').run();
  db.prepare('DROP INDEX IF EXISTS idx_uploads_dequeue').run();
  db.prepare('DROP INDEX IF EXISTS idx_uploads_created_at').run();
  db.prepare('DROP INDEX IF EXISTS idx_uploads_queue_order').run();
  db.prepare('DROP INDEX IF EXISTS idx_uploads_status').run();
  db.prepare('DROP TABLE IF EXISTS uploads').run();
};
