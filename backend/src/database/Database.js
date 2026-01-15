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
    this.initialized = false;
    // Master database path
    const masterDbPath = process.env.MASTER_DB_PATH || '/app/data/master.db';
    this.dbPath = masterDbPath.startsWith('sqlite://')
      ? masterDbPath.replace('sqlite://', '')
      : masterDbPath;

    console.log('Master database path:', this.dbPath);
  }

  async initialize() {
    // Prevent double initialization
    if (this.initialized) {
      logger.warn('Database already initialized, skipping initialization', {
        dbPath: this.dbPath,
      });
      return;
    }

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

      // Mark as initialized
      this.initialized = true;

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

  /**
   * Check if an error is a closed database error
   * @param {Error} error - Error to check
   * @returns {boolean} - True if error indicates closed database
   */
  isClosedDatabaseError(error) {
    return (
      error.name === 'RangeError' ||
      (error.message &&
        (error.message.includes('closed database') ||
          error.message.includes('Cannot use a closed database')))
    );
  }

  /**
   * Check if database connection is valid and refresh if needed
   * @returns {Promise<void>}
   */
  async ensureConnection() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    // Check if database is still valid by attempting a simple query
    try {
      this.db.prepare('SELECT 1').get();
      // Connection is valid, no need to refresh
      return;
    } catch (error) {
      // Database is closed or invalid, need to refresh
      if (this.isClosedDatabaseError(error)) {
        logger.warn('Database connection is closed, refreshing connection', {
          errorName: error.name,
          errorMessage: error.message,
        });

        // Reopen the database connection
        this.db = new SQLiteDatabase(this.dbPath);

        // Re-enable WAL mode and busy timeout
        this.db.prepare('PRAGMA journal_mode = WAL').run();
        this.db.prepare('PRAGMA busy_timeout = 5000').run();

        // Re-initialize migration runner with new connection
        this.migrationRunner = new MigrationRunner(this.db, 'master');

        logger.info('Database connection refreshed successfully');
      } else {
        // Some other error, re-throw it
        throw error;
      }
    }
  }

  /**
   * Execute a database operation with automatic retry on closed database error
   * @param {Function} operation - Function to execute
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, operationName) {
    try {
      // Ensure connection is valid before executing
      await this.ensureConnection();
      return operation();
    } catch (error) {
      // Check if this is a closed database error and retry with fresh connection
      if (this.isClosedDatabaseError(error)) {
        logger.warn(`Database connection closed during ${operationName}, refreshing and retrying`, {
          errorName: error.name,
          errorMessage: error.message,
        });

        // Refresh connection and retry
        await this.ensureConnection();
        return operation();
      } else {
        // Re-throw if not a closed database error
        throw error;
      }
    }
  }

  runQuery(sql, params = []) {
    try {
      // Ensure connection is valid before executing
      if (!this.db) {
        throw new Error('Database not initialized. Call initialize() first.');
      }

      // Check connection by attempting a simple query
      try {
        this.db.prepare('SELECT 1').get();
      } catch (checkError) {
        if (this.isClosedDatabaseError(checkError)) {
          // Connection is closed, refresh it synchronously (for sync methods)
          logger.warn('Database connection is closed in runQuery, refreshing connection', {
            errorName: checkError.name,
            errorMessage: checkError.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          logger.info('Database connection refreshed successfully in runQuery');
        } else {
          throw checkError;
        }
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(params);
      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (error) {
      // If it's a closed database error, try to refresh and retry once
      if (this.isClosedDatabaseError(error)) {
        try {
          logger.warn('Database connection closed during runQuery, refreshing and retrying', {
            errorName: error.name,
            errorMessage: error.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          const stmt = this.db.prepare(sql);
          const result = stmt.run(params);
          return { id: result.lastInsertRowid, changes: result.changes };
        } catch (retryError) {
          logger.error('Database query execution failed after retry', retryError, {
            sql: sql.substring(0, 100),
            paramsCount: params.length,
          });
          throw retryError;
        }
      }

      logger.error('Database query execution failed', error, {
        sql: sql.substring(0, 100), // Log first 100 chars of SQL for debugging
        paramsCount: params.length,
      });
      throw error;
    }
  }

  getQuery(sql, params = []) {
    try {
      // Ensure connection is valid before executing
      if (!this.db) {
        throw new Error('Database not initialized. Call initialize() first.');
      }

      // Check connection by attempting a simple query
      try {
        this.db.prepare('SELECT 1').get();
      } catch (checkError) {
        if (this.isClosedDatabaseError(checkError)) {
          logger.warn('Database connection is closed in getQuery, refreshing connection', {
            errorName: checkError.name,
            errorMessage: checkError.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          logger.info('Database connection refreshed successfully in getQuery');
        } else {
          throw checkError;
        }
      }

      return this.db.prepare(sql).get(params);
    } catch (error) {
      // If it's a closed database error, try to refresh and retry once
      if (this.isClosedDatabaseError(error)) {
        try {
          logger.warn('Database connection closed during getQuery, refreshing and retrying', {
            errorName: error.name,
            errorMessage: error.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          return this.db.prepare(sql).get(params);
        } catch (retryError) {
          throw retryError;
        }
      }
      throw error;
    }
  }

  allQuery(sql, params = []) {
    try {
      // Ensure connection is valid before executing
      if (!this.db) {
        throw new Error('Database not initialized. Call initialize() first.');
      }

      // Check connection by attempting a simple query
      try {
        this.db.prepare('SELECT 1').get();
      } catch (checkError) {
        if (this.isClosedDatabaseError(checkError)) {
          logger.warn('Database connection is closed in allQuery, refreshing connection', {
            errorName: checkError.name,
            errorMessage: checkError.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          logger.info('Database connection refreshed successfully in allQuery');
        } else {
          throw checkError;
        }
      }

      return this.db.prepare(sql).all(params);
    } catch (error) {
      // If it's a closed database error, try to refresh and retry once
      if (this.isClosedDatabaseError(error)) {
        try {
          logger.warn('Database connection closed during allQuery, refreshing and retrying', {
            errorName: error.name,
            errorMessage: error.message,
          });

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          return this.db.prepare(sql).all(params);
        } catch (retryError) {
          throw retryError;
        }
      }
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

    // Check if API key already exists in api_keys table
    const existing = this.getQuery('SELECT auth_id FROM api_keys WHERE auth_id = ?', [authId]);

    if (existing) {
      // Update existing
      this.runQuery(
        `
        UPDATE api_keys 
        SET encrypted_key = ?, key_name = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE auth_id = ?
      `,
        [encryptedKey, keyName, authId]
      );
    } else {
      // Insert new
      this.runQuery(
        `
        INSERT INTO api_keys (auth_id, encrypted_key, key_name, is_active)
        VALUES (?, ?, ?, 1)
      `,
        [authId, encryptedKey, keyName]
      );
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
    return this.getQuery('SELECT encrypted_key FROM api_keys WHERE auth_id = ? AND is_active = 1', [
      authId,
    ]);
  }

  /**
   * Deactivate an API key
   */
  deactivateApiKey(authId) {
    this.runQuery(
      'UPDATE api_keys SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?',
      [authId]
    );
    this.runQuery(
      'UPDATE user_registry SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?',
      [authId]
    );

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
    this.runQuery(
      'UPDATE user_registry SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE auth_id = ?',
      [status, authId]
    );

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
    try {
      // Ensure connection is valid before executing
      if (!this.db) {
        throw new Error('Database not initialized. Call initialize() first.');
      }

      // Check connection by attempting a simple query
      try {
        this.db.prepare('SELECT 1').get();
      } catch (checkError) {
        if (this.isClosedDatabaseError(checkError)) {
          logger.warn(
            'Database connection is closed in updateActiveRulesFlag, refreshing connection',
            {
              errorName: checkError.name,
              errorMessage: checkError.message,
              authId,
            }
          );

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          logger.info('Database connection refreshed successfully in updateActiveRulesFlag');
        } else {
          throw checkError;
        }
      }

      // Use transaction for atomic update to prevent race conditions
      const transaction = this.db.transaction(() => {
        this.runQuery(
          `
          UPDATE user_registry 
          SET has_active_rules = ?, updated_at = CURRENT_TIMESTAMP
          WHERE auth_id = ?
        `,
          [hasActiveRules ? 1 : 0, authId]
        );
      });

      transaction();

      // Invalidate cache since user registry changed
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();
    } catch (error) {
      // If it's a closed database error, try to refresh and retry once
      if (this.isClosedDatabaseError(error)) {
        try {
          logger.warn(
            'Database connection closed during updateActiveRulesFlag, refreshing and retrying',
            {
              errorName: error.name,
              errorMessage: error.message,
              authId,
            }
          );

          this.db = new SQLiteDatabase(this.dbPath);
          this.db.prepare('PRAGMA journal_mode = WAL').run();
          this.db.prepare('PRAGMA busy_timeout = 5000').run();
          this.migrationRunner = new MigrationRunner(this.db, 'master');

          // Retry the transaction
          const transaction = this.db.transaction(() => {
            this.runQuery(
              `
              UPDATE user_registry 
              SET has_active_rules = ?, updated_at = CURRENT_TIMESTAMP
              WHERE auth_id = ?
            `,
              [hasActiveRules ? 1 : 0, authId]
            );
          });

          transaction();

          // Invalidate cache since user registry changed
          cache.invalidateUserRegistry(authId);
          cache.invalidateActiveUsers();
        } catch (retryError) {
          logger.error('Transaction failed in updateActiveRulesFlag after retry', retryError, {
            authId,
            hasActiveRules,
          });
          throw retryError;
        }
      } else {
        logger.error('Transaction failed in updateActiveRulesFlag', error, {
          authId,
          hasActiveRules,
        });
        throw error;
      }
    }
  }

  /**
   * Update next poll timestamp and non-terminal torrent count
   * @param {string} authId - User authentication ID
   * @param {Date} nextPollAt - Next poll timestamp
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   */
  updateNextPollAt(authId, nextPollAt, nonTerminalCount) {
    this.runQuery(
      `
      UPDATE user_registry 
      SET next_poll_at = ?, non_terminal_torrent_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE auth_id = ?
    `,
      [nextPollAt.toISOString(), nonTerminalCount, authId]
    );

    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
  }

  /**
   * Update upload counters for a user
   * Should be called after upload insert/update/delete operations
   * @param {string} authId - User authentication ID
   * @param {Object} userDb - User database instance (to query uploads)
   */
  async updateUploadCounters(authId, userDb) {
    try {
      // Query actual counts from user DB
      // Count ALL queued uploads (including deferred ones, but excluding deleted files)
      // The next_upload_attempt_at field in user_registry handles timing logic,
      // so we don't need to exclude deferred uploads from the counter
      // However, we must exclude deleted files (file_deleted = true) as they cannot be processed
      const queuedCount = userDb.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM uploads
          WHERE status = 'queued'
            AND (file_deleted IS NULL OR file_deleted = false)
        `
        )
        .get();

      const queuedUploadsCount = queuedCount?.count || 0;

      // Check if there are any uploads ready to process immediately (next_attempt_at IS NULL)
      // If any uploads are ready, we should set next_upload_attempt_at to NULL
      // so that getUsersWithQueuedUploads includes this user for processing
      // Exclude deleted files (file_deleted = true) as they cannot be processed
      const readyUploadsCount = userDb.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM uploads
          WHERE status = 'queued'
            AND (file_deleted IS NULL OR file_deleted = false)
            AND (next_attempt_at IS NULL 
                 OR next_attempt_at = ''
                 OR datetime(next_attempt_at) <= datetime('now'))
        `
        )
        .get();

      const hasReadyUploads = (readyUploadsCount?.count || 0) > 0;

      let nextUploadAttemptAt = null;

      if (hasReadyUploads) {
        // If there are uploads ready to process immediately, set next_upload_attempt_at to NULL
        // This ensures getUsersWithQueuedUploads will include this user
        nextUploadAttemptAt = null;
      } else if (queuedUploadsCount > 0) {
        // If all uploads are deferred, get the minimum deferred time
        // Exclude deleted files (file_deleted = true) as they cannot be processed
        const nextAttemptResult = userDb.db
          .prepare(
            `
            SELECT MIN(next_attempt_at) as min_next_attempt_at
            FROM uploads
            WHERE status = 'queued'
              AND (file_deleted IS NULL OR file_deleted = false)
              AND next_attempt_at IS NOT NULL
              AND next_attempt_at != ''
              AND COALESCE(datetime(next_attempt_at), '9999-12-31 23:59:59') > datetime('now')
          `
          )
          .get();

        nextUploadAttemptAt = nextAttemptResult?.min_next_attempt_at || null;
      }
      // If queuedUploadsCount is 0, nextUploadAttemptAt remains null

      // Update master DB
      this.runQuery(
        `
        UPDATE user_registry 
        SET queued_uploads_count = ?, 
            next_upload_attempt_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE auth_id = ?
      `,
        [queuedUploadsCount, nextUploadAttemptAt, authId]
      );

      // Log the update for debugging (only if count > 0)
      if (queuedUploadsCount > 0) {
        logger.debug('Updated upload counters', {
          authId,
          queuedUploadsCount,
          nextUploadAttemptAt,
        });
      }

      // Invalidate cache
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();
    } catch (error) {
      logger.error('Failed to update upload counters', error, {
        authId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      // Don't throw - counter updates shouldn't break upload operations
    }
  }

  /**
   * Increment upload counter (optimized for single insert)
   * @param {string} authId - User authentication ID
   * @param {string|null} nextAttemptAt - Next attempt timestamp (ISO string or null)
   */
  incrementUploadCounter(authId, nextAttemptAt = null) {
    try {
      // Use transaction for atomic update
      const transaction = this.db.transaction(() => {
        // Get current values
        const current = this.getQuery(
          `
          SELECT queued_uploads_count, next_upload_attempt_at
          FROM user_registry
          WHERE auth_id = ?
        `,
          [authId]
        );

        const newCount = (current?.queued_uploads_count || 0) + 1;
        let newNextAttemptAt = nextAttemptAt;

        // If the new upload is ready immediately (nextAttemptAt is null),
        // set next_upload_attempt_at to null so the user is included in getUsersWithQueuedUploads
        if (!nextAttemptAt) {
          newNextAttemptAt = null;
        } else if (current?.next_upload_attempt_at) {
          // If both new and current are deferred, take the minimum
          const currentDate = new Date(current.next_upload_attempt_at);
          const newDate = new Date(nextAttemptAt);
          newNextAttemptAt = newDate < currentDate ? nextAttemptAt : current.next_upload_attempt_at;
        }

        this.runQuery(
          `
          UPDATE user_registry 
          SET queued_uploads_count = ?,
              next_upload_attempt_at = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE auth_id = ?
        `,
          [newCount, newNextAttemptAt, authId]
        );
      });

      transaction();

      // Invalidate cache
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();
    } catch (error) {
      logger.error('Failed to increment upload counter', error, {
        authId,
      });
      // Don't throw - counter updates shouldn't break upload operations
    }
  }

  /**
   * Decrement upload counter (optimized for single status change)
   * @param {string} authId - User authentication ID
   */
  decrementUploadCounter(authId) {
    try {
      // Use transaction for atomic update
      const transaction = this.db.transaction(() => {
        // Get current count first, then update (SQLite doesn't have GREATEST/MAX in UPDATE)
        const current = this.getQuery(
          `
          SELECT queued_uploads_count
          FROM user_registry
          WHERE auth_id = ?
        `,
          [authId]
        );

        const newCount = Math.max(0, (current?.queued_uploads_count || 0) - 1);

        this.runQuery(
          `
          UPDATE user_registry 
          SET queued_uploads_count = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE auth_id = ?
        `,
          [newCount, authId]
        );
      });

      transaction();

      // Invalidate cache
      cache.invalidateUserRegistry(authId);
      cache.invalidateActiveUsers();
    } catch (error) {
      logger.error('Failed to decrement upload counter', error, {
        authId,
      });
      // Don't throw - counter updates shouldn't break upload operations
    }
  }

  /**
   * Get users with queued uploads ready for processing
   * Optimized query that filters at master DB level before opening user DBs
   * @returns {Array} - Array of users with queued uploads ready to process
   */
  getUsersWithQueuedUploads() {
    // SQLite stores booleans as INTEGER (0 or 1), so we need to handle type coercion
    // Also handle potential NULL values in queued_uploads_count
    const result = this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name, ak.is_active as api_key_active
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' 
        AND (CAST(ak.is_active AS INTEGER) = 1 OR ak.is_active IS NULL)
        AND COALESCE(ur.queued_uploads_count, 0) > 0
        AND (
          ur.next_upload_attempt_at IS NULL 
          OR ur.next_upload_attempt_at = ''
          OR ur.next_upload_attempt_at = '0'
          OR ur.next_upload_attempt_at = '0000-00-00 00:00:00'
          OR datetime(
            substr(
              replace(replace(ur.next_upload_attempt_at, 'T', ' '), 'Z', ''),
              1,
              19
            )
          ) <= datetime('now')
        )
      ORDER BY COALESCE(
        NULLIF(NULLIF(NULLIF(ur.next_upload_attempt_at, ''), '0'), '0000-00-00 00:00:00'),
        '1970-01-01 00:00:00'
      ) ASC
    `);

    logger.debug('Users with queued uploads', {
      foundCount: result.length,
      authIds: result.map((u) => u.auth_id),
    });

    return result;
  }

  /**
   * Sync upload counters for all users (safety net to fix drift)
   * Should be called periodically or on startup
   * @param {Object} userDatabaseManager - User database manager instance
   */
  async syncUploadCountersForAllUsers(userDatabaseManager) {
    if (!userDatabaseManager) {
      logger.warn('UserDatabaseManager not available, skipping upload counter sync');
      return;
    }

    try {
      const activeUsers = this.getActiveUsers();
      let synced = 0;
      let errors = 0;

      for (const user of activeUsers) {
        try {
          const userDb = await userDatabaseManager.getUserDatabase(user.auth_id);
          await this.updateUploadCounters(user.auth_id, userDb);
          synced++;
        } catch (error) {
          logger.error('Failed to sync upload counters for user', error, {
            authId: user.auth_id,
          });
          errors++;
        }
      }

      logger.info('Upload counter sync completed', {
        total: activeUsers.length,
        synced,
        errors,
      });
    } catch (error) {
      logger.error('Failed to sync upload counters', error);
    }
  }

  /**
   * Get users due for polling (cron-like query)
   * Only returns users with has_active_rules = 1
   * @returns {Array} - Array of users where has_active_rules = 1 AND (next_poll_at <= NOW() OR next_poll_at IS NULL/empty/0) AND status = 'active'
   */
  getUsersDueForPolling() {
    // Convert ISO format (2026-01-11T13:04:23.860Z) to SQLite datetime format (2026-01-11 13:04:23)
    // for proper datetime comparison. Handle both ISO and SQLite formats.
    // Strategy: Replace T with space, remove Z, then extract first 19 chars (YYYY-MM-DD HH:MM:SS)
    // Only poll users with active rules (has_active_rules = 1)
    const result = this.allQuery(`
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.status = 'active' 
        AND (ak.is_active = 1 OR ak.is_active IS NULL)
        AND ur.has_active_rules = 1
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
            ur.next_poll_at IS NULL 
            OR ur.next_poll_at = '' 
            OR ur.next_poll_at = '0'
            OR ur.next_poll_at = '0000-00-00 00:00:00'
          )
        )
      ORDER BY COALESCE(
        NULLIF(NULLIF(NULLIF(ur.next_poll_at, ''), '0'), '0000-00-00 00:00:00'),
        '9999-12-31 23:59:59'
      ) ASC
    `);

    // Log at debug level since this runs frequently (every 30 seconds)
    logger.debug('Users due for polling', {
      foundCount: result.length,
      authIds: result.map((u) => u.auth_id),
      nextPollAts: result.map((u) => ({
        authId: u.auth_id,
        nextPollAt: u.next_poll_at,
        hasActiveRules: u.has_active_rules,
      })),
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
    const userInfo = this.getQuery(
      `
      SELECT ur.*, ak.encrypted_key, ak.key_name
      FROM user_registry ur
      LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
      WHERE ur.auth_id = ?
    `,
      [authId]
    );

    // Cache the result (even if null)
    cache.setUserRegistry(authId, userInfo);
    return userInfo;
  }
}

export default Database;
