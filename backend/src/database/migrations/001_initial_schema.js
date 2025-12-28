/**
 * Initial schema migration
 * Creates all base tables for the TorBox backend
 */
export const up = (db) => {
  const tables = [
    // Automation rules table
    `CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled BOOLEAN DEFAULT true,
      trigger_config TEXT NOT NULL,
      conditions TEXT NOT NULL,
      action_config TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Download history table
    `CREATE TABLE IF NOT EXISTS download_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      download_url TEXT NOT NULL,
      file_size INTEGER,
      status TEXT DEFAULT 'completed',
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // User settings table
    `CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Storage table for key-value pairs
    `CREATE TABLE IF NOT EXISTS storage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // API keys table (encrypted)
    `CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      is_active BOOLEAN DEFAULT false,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Rule execution log
    `CREATE TABLE IF NOT EXISTS rule_execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      execution_type TEXT NOT NULL,
      items_processed INTEGER DEFAULT 0,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES automation_rules (id)
    )`
  ];

  for (const table of tables) {
    db.prepare(table).run();
  }
};

export const down = (db) => {
  const tables = [
    'rule_execution_log',
    'api_keys',
    'storage',
    'user_settings',
    'download_history',
    'automation_rules'
  ];

  for (const table of tables) {
    db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  }
};

