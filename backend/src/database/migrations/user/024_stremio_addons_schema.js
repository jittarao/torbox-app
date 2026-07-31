/**
 * Stremio stream addons — per-user installed manifest configuration
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS stremio_addons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      addon_id TEXT NOT NULL,
      manifest_url TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      version TEXT,
      logo TEXT,
      description TEXT,
      manifest_json TEXT NOT NULL,
      resources_json TEXT NOT NULL,
      types_json TEXT NOT NULL,
      id_prefixes_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_refresh TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();

  db.prepare(
    `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stremio_addons_addon_id
    ON stremio_addons(addon_id)
  `
  ).run();

  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_stremio_addons_sort_order
    ON stremio_addons(sort_order)
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_stremio_addons_sort_order').run();
  db.prepare('DROP INDEX IF EXISTS idx_stremio_addons_addon_id').run();
  db.prepare('DROP TABLE IF EXISTS stremio_addons').run();
};
