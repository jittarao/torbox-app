/**
 * Master database schema for user registry and API key management
 * This migration creates tables in the master database for managing
 * multiple users and their per-user SQLite databases
 */
export const up = (db) => {
  // User registry table - maps auth_id to database path
  db.prepare(`
    CREATE TABLE IF NOT EXISTS user_registry (
      auth_id TEXT PRIMARY KEY,
      db_path TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      has_active_rules INTEGER DEFAULT 0,
      non_terminal_torrent_count INTEGER DEFAULT 0,
      next_poll_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create index for faster lookups
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_registry_status 
    ON user_registry(status)
  `).run();

  // Create index for efficient polling queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_registry_polling 
    ON user_registry(has_active_rules, next_poll_at, status)
  `).run();

  // API keys table - stores encrypted API keys (multi-user schema)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auth_id TEXT NOT NULL UNIQUE,
      encrypted_key TEXT NOT NULL,
      key_name TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auth_id) REFERENCES user_registry (auth_id) ON DELETE CASCADE
    )
  `).run();

  // Create index for active keys lookup
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_api_keys_active 
    ON api_keys(is_active, auth_id)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_api_keys_active').run();
  db.prepare('DROP TABLE IF EXISTS api_keys').run();
  db.prepare('DROP INDEX IF EXISTS idx_user_registry_status').run();
  db.prepare('DROP TABLE IF EXISTS user_registry').run();
};

