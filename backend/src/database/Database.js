import { Database as SQLiteDatabase } from 'bun:sqlite';
import path from 'path';
import { mkdir } from 'fs/promises';
import MigrationRunner from './MigrationRunner.js';
import { encrypt, hashApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';

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
      try {
        await mkdir(dataDir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
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
      
      logger.info('Master database initialized', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('Master database initialization failed', error, { dbPath: this.dbPath });
      throw error;
    }
  }

  /**
   * Get migration status (for debugging/admin purposes)
   */
  async getMigrationStatus() {
    if (!this.migrationRunner) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return await this.migrationRunner.getMigrationStatus();
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
      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (error) {
      logger.error('Database query execution failed', error, { 
        sql: sql.substring(0, 100), // Log first 100 chars of SQL for debugging
        paramsCount: params.length 
      });
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

    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
    cache.invalidateActiveUsers();

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
    
    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
    cache.invalidateActiveUsers();
  }

  /**
   * Update user status
   * @param {string} authId - User authentication ID
   * @param {string} status - New status ('active', 'inactive', etc.)
   */
  updateUserStatus(authId, status) {
    this.runQuery('UPDATE user_registry SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?', [status, authId]);
    
    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
    cache.invalidateActiveUsers();
  }

  /**
   * Get all active users
   */
  getActiveUsers() {
    // Check cache first
    const cached = cache.getActiveUsers();
    if (cached !== undefined) {
      return cached;
    }

    // Query database if not cached
    const users = this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' AND ak.is_active = 1
      ORDER BY ur.created_at ASC
    `);
    
    // Cache the result
    cache.setActiveUsers(users);
    return users;
  }

  /**
   * Update active rules flag for a user
   * @param {string} authId - User authentication ID
   * @param {boolean} hasActiveRules - Whether user has active automation rules
   */
  updateActiveRulesFlag(authId, hasActiveRules) {
    // Use transaction for atomic update to prevent race conditions
    const transaction = this.db.transaction(() => {
      this.runQuery(`
        UPDATE user_registry 
        SET has_active_rules = ?, updated_at = CURRENT_TIMESTAMP
        WHERE auth_id = ?
      `, [hasActiveRules ? 1 : 0, authId]);
    });
    
    try {
      transaction();
      
      // Invalidate cache since user registry changed
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();
    } catch (error) {
      logger.error('Transaction failed in updateActiveRulesFlag', error, { authId, hasActiveRules });
      throw error;
    }
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
    
    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
  }

  /**
   * Get users due for polling (cron-like query)
   * @returns {Array} - Array of users where next_poll_at <= NOW() OR (next_poll_at IS NULL/empty/0 AND has_active_rules = 1) AND status = 'active'
   */
  getUsersDueForPolling() {
    // First, let's check all active users with active rules to see their next_poll_at status
    const allActiveUsersWithRules = this.allQuery(`
      SELECT ur.auth_id, ur.next_poll_at, ur.has_active_rules, ur.status
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' 
        AND (ak.is_active = 1 OR ak.is_active IS NULL)
        AND ur.has_active_rules = 1
    `);
    
    logger.info('Active users with rules status', {
      count: allActiveUsersWithRules.length,
      users: allActiveUsersWithRules.map(u => ({
        authId: u.auth_id,
        nextPollAt: u.next_poll_at,
        hasActiveRules: u.has_active_rules
      }))
    });
    
    // Convert ISO format (2026-01-11T13:04:23.860Z) to SQLite datetime format (2026-01-11 13:04:23)
    // for proper datetime comparison. Handle both ISO and SQLite formats.
    // Strategy: Replace T with space, remove Z, then extract first 19 chars (YYYY-MM-DD HH:MM:SS)
    const result = this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' 
        AND (ak.is_active = 1 OR ak.is_active IS NULL)
        AND (
          (
            ur.next_poll_at IS NOT NULL 
            AND ur.next_poll_at != '' 
            AND ur.next_poll_at != '0'
            AND ur.next_poll_at != '0000-00-00 00:00:00'
            AND datetime(
              substr(
                replace(replace(ur.next_poll_at, 'T', ' '), 'Z', ''),
                1,
                19
              )
            ) <= datetime('now')
          )
          OR (
            (ur.next_poll_at IS NULL 
             OR ur.next_poll_at = '' 
             OR ur.next_poll_at = '0'
             OR ur.next_poll_at = '0000-00-00 00:00:00')
            AND ur.has_active_rules = 1
          )
        )
      ORDER BY COALESCE(
        NULLIF(NULLIF(NULLIF(ur.next_poll_at, ''), '0'), '0000-00-00 00:00:00'),
        '9999-12-31 23:59:59'
      ) ASC
    `);
    
    // Log for debugging
    logger.info('Users due for polling query result', {
      foundCount: result.length,
      authIds: result.map(u => u.auth_id),
      nextPollAts: result.map(u => ({ authId: u.auth_id, nextPollAt: u.next_poll_at, hasActiveRules: u.has_active_rules }))
    });
    
    return result;
  }

  /**
   * Get user registry info for a specific user
   * @param {string} authId - User authentication ID
   * @returns {Object|null} - User registry info or null if not found
   */
  getUserRegistryInfo(authId) {
    // Check cache first
    const cached = cache.getUserRegistry(authId);
    if (cached !== undefined) {
      return cached;
    }

    // Query database if not cached
    const userInfo = this.getQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.auth_id = ?
    `, [authId]);
    
    // Cache the result (even if null)
    cache.setUserRegistry(authId, userInfo);
    return userInfo;
  }
}

export default Database;
