/**
 * Add last_evaluated_at column to automation_rules
 * Tracks when each rule was last evaluated (checked), separate from execution
 */
export const up = (db) => {
  // Add last_evaluated_at column if it doesn't exist
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
  // So we check if column exists first
  const tableInfo = db.prepare("PRAGMA table_info(automation_rules)").all();
  const hasColumn = tableInfo.some(col => col.name === 'last_evaluated_at');
  
  if (!hasColumn) {
    db.prepare(`
      ALTER TABLE automation_rules 
      ADD COLUMN last_evaluated_at DATETIME
    `).run();
    
    // Set last_evaluated_at = last_executed_at for existing rules that have been executed
    // This provides a reasonable starting point for existing rules
    db.prepare(`
      UPDATE automation_rules 
      SET last_evaluated_at = last_executed_at 
      WHERE last_executed_at IS NOT NULL
    `).run();
  }

  // Create index for efficient interval queries
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_automation_rules_evaluation 
    ON automation_rules(enabled, last_evaluated_at)
  `).run();
};

export const down = (db) => {
  db.prepare('DROP INDEX IF EXISTS idx_automation_rules_evaluation').run();
  // Note: SQLite doesn't support DROP COLUMN easily, so we'll leave the column
  // in case of rollback - it won't hurt to have it
};
