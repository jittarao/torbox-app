/**
 * Automation rules schema
 * Creates the base automation_rules table for per-user databases
 */
export const up = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled BOOLEAN DEFAULT true,
      trigger_config TEXT NOT NULL,
      conditions TEXT NOT NULL,
      action_config TEXT NOT NULL,
      metadata TEXT,
      cooldown_minutes INTEGER DEFAULT 0,
      last_executed_at DATETIME,
      execution_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Create index for enabled rules lookup
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled 
    ON automation_rules(enabled)
  `).run();

  // Create index for cooldown queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_automation_rules_cooldown 
    ON automation_rules(enabled, last_executed_at)
  `).run();

  // Rule execution log table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS rule_execution_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      execution_type TEXT NOT NULL,
      items_processed INTEGER DEFAULT 0,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE
    )
  `).run();

  // Create index for rule execution history queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_rule_execution_log_rule_id 
    ON rule_execution_log(rule_id, executed_at)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_rule_execution_log_rule_id').run();
  db.prepare('DROP TABLE IF EXISTS rule_execution_log').run();
  db.prepare('DROP INDEX IF EXISTS idx_automation_rules_cooldown').run();
  db.prepare('DROP INDEX IF EXISTS idx_automation_rules_enabled').run();
  db.prepare('DROP TABLE IF EXISTS automation_rules').run();
};

