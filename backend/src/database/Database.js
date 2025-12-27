import { Database as SQLiteDatabase } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import MigrationRunner from './MigrationRunner.js';

class Database {
  constructor() {
    this.db = null;
    this.migrationRunner = null;
    // Handle both sqlite:// URL format and direct path
    const dbUrl = process.env.DATABASE_URL || '/app/data/torbox.db';
    this.dbPath = dbUrl.startsWith('sqlite://') 
      ? dbUrl.replace('sqlite://', '') 
      : dbUrl;
    
    console.log('Database path:', this.dbPath);
  }

  async initialize() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database connection
      this.db = new SQLiteDatabase(this.dbPath);
      
      // Initialize migration runner
      this.migrationRunner = new MigrationRunner(this.db);
      
      // Run migrations
      await this.migrationRunner.runMigrations();
      
      console.log(`Database initialized at: ${this.dbPath}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status (for debugging/admin purposes)
   */
  getMigrationStatus() {
    if (!this.migrationRunner) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.migrationRunner.getMigrationStatus();
  }

  /**
   * Rollback a specific migration (use with caution)
   */
  async rollbackMigration(version) {
    if (!this.migrationRunner) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return await this.migrationRunner.rollbackMigration(version);
  }

  runQuery(sql, params = []) {
    try {
      const result = this.db.prepare(sql).run(params);
      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (error) {
      throw error;
    }
  }

  getQuery(sql, params = []) {
    try {
      return this.db.prepare(sql).get(params);
    } catch (error) {
      throw error;
    }
  }

  allQuery(sql, params = []) {
    try {
      return this.db.prepare(sql).all(params);
    } catch (error) {
      throw error;
    }
  }

  // Automation rules methods
  async getAutomationRules() {
    const sql = 'SELECT * FROM automation_rules ORDER BY created_at DESC';
    const rules = this.allQuery(sql);
    return rules.map(rule => ({
      ...rule,
      trigger_config: JSON.parse(rule.trigger_config),
      conditions: JSON.parse(rule.conditions),
      action_config: JSON.parse(rule.action_config),
      metadata: rule.metadata ? JSON.parse(rule.metadata) : null
    }));
  }

  async saveAutomationRules(rules) {
    // Clear existing rules
    this.runQuery('DELETE FROM automation_rules');
    
    // Insert new rules
    for (const rule of rules) {
      const sql = `
        INSERT INTO automation_rules (name, enabled, trigger_config, conditions, action_config, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      this.runQuery(sql, [
        rule.name,
        rule.enabled,
        JSON.stringify(rule.trigger || rule.trigger_config),
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.action || rule.action_config),
        JSON.stringify(rule.metadata || {})
      ]);
    }
  }

  // Download history methods
  async getDownloadHistory() {
    const sql = 'SELECT * FROM download_history ORDER BY downloaded_at DESC LIMIT 1000';
    return this.allQuery(sql);
  }

  async saveDownloadHistory(history) {
    // Clear existing history
    this.runQuery('DELETE FROM download_history');
    
    // Insert new history
    for (const item of history) {
      const sql = `
        INSERT INTO download_history (item_id, item_name, item_type, download_url, file_size, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      this.runQuery(sql, [
        item.id || item.item_id,
        item.name || item.item_name,
        item.type || item.item_type,
        item.url || item.download_url,
        item.size || item.file_size,
        item.status || 'completed'
      ]);
    }
  }

  // Generic storage methods
  async getStorageValue(key) {
    const sql = 'SELECT value FROM storage WHERE key = ?';
    const result = this.getQuery(sql, [key]);
    return result ? JSON.parse(result.value) : null;
  }

  async setStorageValue(key, value) {
    const sql = `
      INSERT OR REPLACE INTO storage (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    this.runQuery(sql, [key, JSON.stringify(value)]);
  }

  // Rule execution logging
  async logRuleExecution(ruleId, ruleName, executionType, itemsProcessed = 0, success = true, errorMessage = null) {
    const sql = `
      INSERT INTO rule_execution_log (rule_id, rule_name, execution_type, items_processed, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    this.runQuery(sql, [ruleId, ruleName, executionType, itemsProcessed, success, errorMessage]);
  }

  async getRuleExecutionHistory(ruleId = null, limit = 100) {
    let sql = 'SELECT * FROM rule_execution_log';
    const params = [];
    
    if (ruleId) {
      sql += ' WHERE rule_id = ?';
      params.push(ruleId);
    }
    
    sql += ' ORDER BY executed_at DESC LIMIT ?';
    params.push(limit);
    
    return this.allQuery(sql, params);
  }

  // Update rule status (enable/disable)
  updateRuleStatus(ruleId, enabled) {
    const sql = 'UPDATE automation_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    this.runQuery(sql, [enabled ? 1 : 0, ruleId]);
  }

  // Delete a rule
  deleteRule(ruleId) {
    const sql = 'DELETE FROM automation_rules WHERE id = ?';
    this.runQuery(sql, [ruleId]);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default Database;
