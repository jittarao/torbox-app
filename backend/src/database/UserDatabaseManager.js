import { Database as SQLiteDatabase } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import MigrationRunner from './MigrationRunner.js';
import { hashApiKey } from '../utils/crypto.js';

/**
 * LRU Cache for database connections
 */
class DatabasePool {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      const firstValue = this.cache.get(firstKey);
      if (firstValue && firstValue.db) {
        firstValue.db.close();
      }
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    const value = this.cache.get(key);
    if (value && value.db) {
      value.db.close();
    }
    this.cache.delete(key);
  }

  clear() {
    for (const [key, value] of this.cache) {
      if (value && value.db) {
        value.db.close();
      }
    }
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * Manages per-user SQLite databases with connection pooling
 */
class UserDatabaseManager {
  constructor(masterDb, userDbDir = '/app/data/users') {
    this.masterDb = masterDb;
    this.userDbDir = userDbDir;
    // Increased pool size for better scalability with 1000+ users
    this.pool = new DatabasePool(parseInt(process.env.MAX_DB_CONNECTIONS || '200'));
    
    // Ensure user database directory exists
    if (!fs.existsSync(this.userDbDir)) {
      fs.mkdirSync(this.userDbDir, { recursive: true });
    }
  }

  /**
   * Get or create a user database connection
   * @param {string} authId - User authentication ID (API key hash)
   * @returns {Promise<Object>} - Database connection and migration runner
   */
  async getUserDatabase(authId) {
    if (!authId) {
      throw new Error('authId is required');
    }

    // Check pool first
    const cached = this.pool.get(authId);
    if (cached) {
      return cached;
    }

    // Get user registry entry
    const user = this.masterDb.prepare('SELECT db_path FROM user_registry WHERE auth_id = ?').get(authId);
    if (!user) {
      throw new Error(`User ${authId} not found in registry`);
    }

    const dbPath = user.db_path;

    // Ensure database file exists
    if (!fs.existsSync(dbPath)) {
      // Create parent directory if needed
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Create empty database file
      fs.writeFileSync(dbPath, '');
    }

    // Open database connection
    const db = new SQLiteDatabase(dbPath);
    
    // Enable WAL mode for better concurrency
    db.prepare('PRAGMA journal_mode = WAL').run();
    
    // Set busy timeout
    db.prepare('PRAGMA busy_timeout = 5000').run();
    
    // Initialize migration runner for user database
    const migrationRunner = new MigrationRunner(db, 'user');
    await migrationRunner.runMigrations();

    const dbConnection = { db, migrationRunner, authId, dbPath };
    
    // Cache the connection
    this.pool.set(authId, dbConnection);

    return dbConnection;
  }

  /**
   * Register a new user and create their database
   * @param {string} apiKey - User's API key
   * @param {string} keyName - Optional name for the API key
   * @returns {Promise<string>} - authId of the created user
   */
  async registerUser(apiKey, keyName = null) {
    const authId = hashApiKey(apiKey);
    const dbPath = path.join(this.userDbDir, `user_${authId}.sqlite`);

    // Check if user already exists
    const existing = this.masterDb.prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?').get(authId);
    if (existing) {
      return authId;
    }

    // Insert into user registry
    this.masterDb.prepare(`
      INSERT INTO user_registry (auth_id, db_path)
      VALUES (?, ?)
    `).run(authId, dbPath);

    // Initialize the user database
    await this.getUserDatabase(authId);

    return authId;
  }

  /**
   * Get all active users
   * @returns {Array} - Array of user registry entries
   */
  getActiveUsers() {
    return this.masterDb.prepare(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' AND (ak.is_active = 1 OR ak.is_active IS NULL)
      ORDER BY ur.created_at ASC
    `).all();
  }


  /**
   * Delete a user and their database
   * @param {string} authId - User authentication ID
   */
  async deleteUser(authId) {
    // Get database path
    const user = this.masterDb.prepare('SELECT db_path FROM user_registry WHERE auth_id = ?').get(authId);
    
    if (user) {
      // Close and remove from pool
      this.pool.delete(authId);
      
      // Delete database file
      if (fs.existsSync(user.db_path)) {
        fs.unlinkSync(user.db_path);
      }
    }

    // Delete from registry (cascade will delete API keys)
    this.masterDb.prepare('DELETE FROM user_registry WHERE auth_id = ?').run(authId);
  }

  /**
   * Close all database connections
   */
  closeAll() {
    this.pool.clear();
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      size: this.pool.size(),
      maxSize: this.pool.maxSize
    };
  }
}

export default UserDatabaseManager;

