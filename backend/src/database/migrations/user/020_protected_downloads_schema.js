/**
 * Protected downloads schema
 * Per-user flag table: downloads marked protected reject destructive operations.
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS protected_downloads (
      download_id TEXT PRIMARY KEY,
      protected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS protected_downloads').run();
};
