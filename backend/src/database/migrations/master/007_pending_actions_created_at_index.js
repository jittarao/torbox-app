/**
 * Index pending_actions.created_at for TTL cleanup scans.
 */
export function up(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_actions_created_at
    ON pending_actions(created_at);
  `);
}

export function down(db) {
  db.exec('DROP INDEX IF EXISTS idx_pending_actions_created_at;');
}
