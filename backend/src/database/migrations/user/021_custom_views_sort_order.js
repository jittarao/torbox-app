/**
 * Add sort_order to custom_views for persistent sidebar ordering
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(custom_views)').all();
  const hasColumn = tableInfo.some((col) => col.name === 'sort_order');

  if (!hasColumn) {
    db.prepare(
      `
      ALTER TABLE custom_views
      ADD COLUMN sort_order INTEGER
    `
    ).run();

    // Preserve existing UI order (created_at DESC → sort_order 0..n-1)
    const rows = db
      .prepare(
        `
        SELECT id
        FROM custom_views
        ORDER BY created_at DESC, id DESC
      `
      )
      .all();

    const update = db.prepare(
      `
      UPDATE custom_views
      SET sort_order = ?
      WHERE id = ?
    `
    );

    db.transaction(() => {
      rows.forEach((row, index) => {
        update.run(index, row.id);
      });
    })();

    db.prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_custom_views_sort_order
      ON custom_views(sort_order)
    `
    ).run();
  }
};

export const down = () => {
  // SQLite: column left in place on rollback (harmless)
};
