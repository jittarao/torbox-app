/**
 * Link generation outcome (success | failed) for row highlighting and history UI.
 */
export const up = (db) => {
  db.prepare(
    `
    ALTER TABLE link_history
    ADD COLUMN status TEXT NOT NULL DEFAULT 'success'
  `
  ).run();
};

export const down = (db) => {
  // SQLite cannot DROP COLUMN in older versions; rebuild would be required for full rollback.
  // No-op: status column remains if migration is reverted manually.
  void db;
};
