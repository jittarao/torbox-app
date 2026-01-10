/**
 * Custom views schema
 * Creates the custom_views table for per-user databases
 * Stores saved filter views with filters, sorting, and column preferences
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS custom_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      sort_field TEXT,
      sort_direction TEXT,
      visible_columns TEXT,
      asset_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create index for name lookups
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_custom_views_name 
    ON custom_views(name)
  `).run();

  // Create index for asset type queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_custom_views_asset_type 
    ON custom_views(asset_type)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_custom_views_asset_type').run();
  db.prepare('DROP INDEX IF EXISTS idx_custom_views_name').run();
  db.prepare('DROP TABLE IF EXISTS custom_views').run();
};
