const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class Database {
  constructor() {
    this.db = null;
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
      this.db = new sqlite3.Database(this.dbPath);
      
      // Create tables
      await this.createTables();
      
      console.log(`Database initialized at: ${this.dbPath}`);
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
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
      await this.runQuery(table);
    }
  }

  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Automation rules methods
  async getAutomationRules() {
    const sql = 'SELECT * FROM automation_rules ORDER BY created_at DESC';
    const rules = await this.allQuery(sql);
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
    await this.runQuery('DELETE FROM automation_rules');
    
    // Insert new rules
    for (const rule of rules) {
      const sql = `
        INSERT INTO automation_rules (name, enabled, trigger_config, conditions, action_config, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await this.runQuery(sql, [
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
    return await this.allQuery(sql);
  }

  async saveDownloadHistory(history) {
    // Clear existing history
    await this.runQuery('DELETE FROM download_history');
    
    // Insert new history
    for (const item of history) {
      const sql = `
        INSERT INTO download_history (item_id, item_name, item_type, download_url, file_size, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await this.runQuery(sql, [
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
    const sql = 'SELECT setting_value FROM user_settings WHERE setting_key = ?';
    const result = await this.getQuery(sql, [key]);
    return result ? JSON.parse(result.setting_value) : null;
  }

  async setStorageValue(key, value) {
    const sql = `
      INSERT OR REPLACE INTO user_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    await this.runQuery(sql, [key, JSON.stringify(value)]);
  }

  // Rule execution logging
  async logRuleExecution(ruleId, ruleName, executionType, itemsProcessed = 0, success = true, errorMessage = null) {
    const sql = `
      INSERT INTO rule_execution_log (rule_id, rule_name, execution_type, items_processed, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.runQuery(sql, [ruleId, ruleName, executionType, itemsProcessed, success, errorMessage]);
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
    
    return await this.allQuery(sql, params);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
