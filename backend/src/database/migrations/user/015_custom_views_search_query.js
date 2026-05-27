/**
 * Add search_query to custom_views (saved Downloads search bar text)
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(custom_views)').all();
  const hasColumn = tableInfo.some((col) => col.name === 'search_query');

  if (!hasColumn) {
    db.prepare(
      `
      ALTER TABLE custom_views
      ADD COLUMN search_query TEXT
    `
    ).run();
  }
};

export const down = () => {
  // SQLite: column left in place on rollback (harmless)
};
