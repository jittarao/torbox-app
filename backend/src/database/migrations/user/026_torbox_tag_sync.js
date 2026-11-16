export const up = (db) => {
  db.prepare('ALTER TABLE tags ADD COLUMN remote_seen INTEGER NOT NULL DEFAULT 0').run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS torbox_tag_sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      initialized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS torbox_tag_sync_state').run();
  db.prepare('ALTER TABLE tags DROP COLUMN remote_seen').run();
};
