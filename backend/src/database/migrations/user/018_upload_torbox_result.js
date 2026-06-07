/**
 * Store TorBox createtorrent result fields for public queue status responses.
 */
export const up = (db) => {
  db.prepare('ALTER TABLE uploads ADD COLUMN torbox_hash TEXT').run();
  db.prepare('ALTER TABLE uploads ADD COLUMN torbox_torrent_id INTEGER').run();
  db.prepare('ALTER TABLE uploads ADD COLUMN torbox_auth_id TEXT').run();
  db.prepare('ALTER TABLE uploads ADD COLUMN add_only_if_cached BOOLEAN DEFAULT false').run();
};

export const down = () => {
  // SQLite rollback would require table recreation; leave additive columns in place.
};
