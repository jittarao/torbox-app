/**
 * Per-user encrypted TMDB API key for Search page title lookup
 */
export const up = (db) => {
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS tmdb_credentials (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      encrypted_api_key TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  ).run();
};

export const down = (db) => {
  db.prepare('DROP TABLE IF EXISTS tmdb_credentials').run();
};
