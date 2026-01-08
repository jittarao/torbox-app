import { Database as SQLiteDatabase } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import MigrationRunner from './MigrationRunner.js';
import { encrypt, hashApiKey } from '../utils/crypto.js';

/**
 * Master Database
 * Manages the master database for user registry and API key storage
 */
class Database {
  constructor() {
    this.db = null;
    this.migrationRunner = null;
    // Master database path
    const masterDbPath = process.env.MASTER_DB_PATH || '/app/data/master.db';
    this.dbPath = masterDbPath.startsWith('sqlite://') 
      ? masterDbPath.replace('sqlite://', '') 
      : masterDbPath;
    
    console.log('Master database path:', this.dbPath);
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
      
      // Enable WAL mode
      this.db.prepare('PRAGMA journal_mode = WAL').run();
      this.db.prepare('PRAGMA busy_timeout = 5000').run();
      
      // Initialize migration runner for master database
      this.migrationRunner = new MigrationRunner(this.db, 'master');
      
      // Run migrations
      await this.migrationRunner.runMigrations();
      
      console.log(`Master database initialized at: ${this.dbPath}`);
    } catch (error) {
      console.error('Master database initialization failed:', error);
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

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
    }
  }

  // API Key Management Methods
  /**
   * Register or update an API key
   * @param {string} apiKey - Plain text API key
   * @param {string} keyName - Optional name for the key
   * @returns {Promise<string>} - authId
   */
  async registerApiKey(apiKey, keyName = null) {
    const authId = hashApiKey(apiKey);
    const encryptedKey = encrypt(apiKey);

    // Check if user already exists
    const existing = this.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [authId]);
    
    if (existing) {
      // Update existing
      this.runQuery(`
        UPDATE api_keys 
        SET encrypted_key = ?, key_name = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE auth_id = ?
      `, [encryptedKey, keyName, authId]);
    } else {
      // Insert new
      this.runQuery(`
        INSERT INTO api_keys (auth_id, encrypted_key, key_name, is_active)
        VALUES (?, ?, ?, 1)
      `, [authId, encryptedKey, keyName]);
    }

    return authId;
  }

  /**
   * Get encrypted API key for a user
   */
  getApiKey(authId) {
    return this.getQuery('SELECT encrypted_key FROM api_keys WHERE auth_id = ? AND is_active = 1', [authId]);
  }

  /**
   * Deactivate an API key
   */
  deactivateApiKey(authId) {
    this.runQuery('UPDATE api_keys SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?', [authId]);
    this.runQuery('UPDATE user_registry SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?', [authId]);
  }

  /**
   * Get all active users
   */
  getActiveUsers() {
    return this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' AND ak.is_active = 1
      ORDER BY ur.created_at ASC
    `);
  }

  /**
   * Update active rules flag for a user
   * @param {string} authId - User authentication ID
   * @param {boolean} hasActiveRules - Whether user has active automation rules
   */
  updateActiveRulesFlag(authId, hasActiveRules) {
    this.runQuery(`
      UPDATE user_registry 
      SET has_active_rules = ?, updated_at = CURRENT_TIMESTAMP
      WHERE auth_id = ?
    `, [hasActiveRules ? 1 : 0, authId]);
  }

  /**
   * Update next poll timestamp and non-terminal torrent count
   * @param {string} authId - User authentication ID
   * @param {Date} nextPollAt - Next poll timestamp
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   */
  updateNextPollAt(authId, nextPollAt, nonTerminalCount) {
    this.runQuery(`
      UPDATE user_registry 
      SET next_poll_at = ?, non_terminal_torrent_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE auth_id = ?
    `, [nextPollAt.toISOString(), nonTerminalCount, authId]);
  }

  /**
   * Get users due for polling (cron-like query)
   * @returns {Array} - Array of users where next_poll_at <= NOW() AND status = 'active'
   */
  getUsersDueForPolling() {
    return this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.next_poll_at <= datetime('now') 
        AND ur.status = 'active' 
        AND (ak.is_active = 1 OR ak.is_active IS NULL)
      ORDER BY ur.next_poll_at ASC
    `);
  }
}

export default Database;
