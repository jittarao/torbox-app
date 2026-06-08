/**
 * Store staged file size on upload rows for quota accounting without per-request stat.
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(uploads)').all();
  if (!tableInfo.some((col) => col.name === 'file_size_bytes')) {
    db.prepare('ALTER TABLE uploads ADD COLUMN file_size_bytes INTEGER').run();
  }
};

export const down = () => {
  // SQLite rollback would require table recreation; leave additive column in place.
};
