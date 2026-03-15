/**
 * Add UNIQUE constraint on archived_downloads.torrent_id so INSERT OR IGNORE
 * is atomic and concurrent archive of the same torrent does not duplicate rows.
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_archived_downloads_unique_torrent
    ON archived_downloads(torrent_id)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_archived_downloads_unique_torrent').run();
};
