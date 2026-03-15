/**
 * Pending automation actions queue. Survives restarts so actions are not lost on crash.
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS pending_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      rule_id INTEGER UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_pending_actions_auth_id ON pending_actions(auth_id)'
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_pending_actions_auth_id').run();
  db.prepare('DROP TABLE IF EXISTS pending_actions').run();
};