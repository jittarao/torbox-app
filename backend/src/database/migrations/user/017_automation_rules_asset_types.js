/**
 * Add asset_types to automation_rules (torrent | usenet | webdl per rule)
 */
export const up = (db) => {
  const tableInfo = db.prepare('PRAGMA table_info(automation_rules)').all();
  if (!tableInfo.some((col) => col.name === 'asset_types')) {
    db.prepare(
      `
      ALTER TABLE automation_rules
      ADD COLUMN asset_types TEXT NOT NULL DEFAULT '["torrent"]'
    `
    ).run();
  }

  db.prepare(
    `
    UPDATE automation_rules
    SET asset_types = '["torrent"]'
    WHERE asset_types IS NULL OR asset_types = ''
  `
  ).run();
};

export const down = (db) => {
  // SQLite does not support DROP COLUMN in older versions; recreate table if rollback needed.
  // No-op for simplicity — column left in place on downgrade.
};
