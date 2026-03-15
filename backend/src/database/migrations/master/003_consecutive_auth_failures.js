/**
 * Add consecutive_auth_failures to user_registry for persistent auth failure tracking.
 * Enables deactivation after N consecutive auth failures across poll cycles (poller is recreated each cycle).
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(user_registry)').all();
  const hasColumn = tableInfo.some((col) => col.name === 'consecutive_auth_failures');

  if (!hasColumn) {
    db.prepare(
      `
      ALTER TABLE user_registry
      ADD COLUMN consecutive_auth_failures INTEGER DEFAULT 0
    `
    ).run();
  }
};

export const down = (db) => {
  // SQLite doesn't support DROP COLUMN easily; leave column in place
};
