/**
 * Store TorBox createtorrent result fields for public queue status responses.
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(uploads)').all();
  const columns = new Set(tableInfo.map((col) => col.name));

  if (!columns.has('torbox_hash')) {
    db.prepare('ALTER TABLE uploads ADD COLUMN torbox_hash TEXT').run();
  }
  if (!columns.has('torbox_torrent_id')) {
    db.prepare('ALTER TABLE uploads ADD COLUMN torbox_torrent_id INTEGER').run();
  }
  if (!columns.has('torbox_auth_id')) {
    db.prepare('ALTER TABLE uploads ADD COLUMN torbox_auth_id TEXT').run();
  }
  if (!columns.has('add_only_if_cached')) {
    db.prepare('ALTER TABLE uploads ADD COLUMN add_only_if_cached BOOLEAN DEFAULT false').run();
  }
};

export const down = () => {
  // SQLite rollback would require table recreation; leave additive columns in place.
};
