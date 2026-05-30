/**
 * Index user_registry(queued_uploads_count, next_upload_attempt_at) for
 * getUsersWithQueuedUploads — which runs every upload-processor cycle.
 */
export function up(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_registry_upload_queue
    ON user_registry(queued_uploads_count, next_upload_attempt_at);
  `);
}

export function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_user_registry_upload_queue;');
}
