export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS torbox_tag_sync_pending (
      download_id TEXT PRIMARY KEY,
      last_name TEXT
    )
  `).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS torbox_tag_sync_pending').run();
};
