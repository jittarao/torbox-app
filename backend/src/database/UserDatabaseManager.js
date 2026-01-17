import { Database as SQLiteDatabase } from 'bun:sqlite';
import path from 'path';
import { mkdir, unlink } from 'fs/promises';
import MigrationRunner from './MigrationRunner.js';
import { hashApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';

/**
 * LRU Cache for database connections with metrics and monitoring
 */
class DatabasePool {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map<key, { value, lastAccess, refCount, activeOperations }>

    // Metrics tracking
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      lastEvictionAt: null,
      lastWarningAt: null,
      proactiveEvictions: 0,
    };

    // Warning thresholds (percentage of maxSize)
    this.warningThresholds = {
      warning: 0.8, // 80% - log warning
      critical: 0.9, // 90% - log critical warning
      emergency: 0.95, // 95% - log emergency warning
    };

    // Proactive eviction threshold - start evicting when we reach this percentage
    this.evictionThreshold = 0.85; // 85% - start proactive eviction
    this.idleTimeoutMs = 5 * 60 * 1000; // 5 minutes - evict connections idle for this long
    this.recentAccessWindowMs = 30 * 1000; // 30 seconds - don't evict connections accessed in this window
  }

  /**
   * Get connection from pool
   * @param {string} key - Connection key (authId)
   * @returns {Object|null} - Cached connection or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      // Update last access time and increment reference count
      // Note: refCount is used to track usage frequency, not current usage
      // It helps prioritize which connections to keep, but idle connections
      // can still be evicted based on lastAccess time
      entry.lastAccess = Date.now();
      entry.refCount = (entry.refCount || 0) + 1;
      // Initialize activeOperations if not present
      if (entry.activeOperations === undefined) {
        entry.activeOperations = 0;
      }
      this.metrics.hits++;
      return entry.value;
    }
    this.metrics.misses++;
    return null;
  }

  /**
   * Mark a connection as having an active operation
   * Prevents eviction while operations are in progress
   * @param {string} key - Connection key (authId)
   */
  markActive(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.activeOperations = (entry.activeOperations || 0) + 1;
      entry.lastAccess = Date.now(); // Update access time when marking active
    }
  }

  /**
   * Mark a connection as having completed an operation
   * @param {string} key - Connection key (authId)
   */
  markInactive(key) {
    const entry = this.cache.get(key);
    if (entry && entry.activeOperations > 0) {
      entry.activeOperations--;
    }
  }

  /**
   * Release a connection reference (decrement ref count)
   * @param {string} key - Connection key (authId)
   */
  release(key) {
    const entry = this.cache.get(key);
    if (entry && entry.refCount > 0) {
      entry.refCount--;
    }
  }

  /**
   * Set connection in pool with capacity monitoring and proactive eviction
   * @param {string} key - Connection key (authId)
   * @param {Object} value - Connection object
   */
  set(key, value) {
    const previousSize = this.cache.size;
    const now = Date.now();

    // Check if key already exists
    if (this.cache.has(key)) {
      // Update existing entry
      const entry = this.cache.get(key);
      entry.value = value;
      entry.lastAccess = now;
      // Don't reset refCount - it might be in use
    } else {
      // New connection - check if we need to evict
      const usagePercent = this.cache.size / this.maxSize;

      // Proactive eviction: evict idle connections before hitting max capacity
      if (usagePercent >= this.evictionThreshold) {
        this._evictIdleConnections();
      }

      // If still at capacity after proactive eviction, evict LRU
      if (this.cache.size >= this.maxSize) {
        this._evictLRUConnection();
      }

      // Add new connection with metadata
      this.cache.set(key, {
        value,
        lastAccess: now,
        refCount: 0, // Will be incremented when get() is called
        activeOperations: 0, // Track active operations to prevent eviction
      });
    }

    // Check and log capacity warnings
    this._checkCapacityWarnings(previousSize);
  }

  /**
   * Evict idle connections (not recently used)
   * Note: We evict based on lastAccess time, not refCount, since refCount
   * represents total usage, not current usage. A connection with high refCount
   * but old lastAccess is still idle and can be evicted.
   * IMPORTANT: Never evict connections with active operations (activeOperations > 0)
   * @private
   */
  _evictIdleConnections() {
    const now = Date.now();
    const keysToEvict = [];

    // Find idle connections (idle for longer than timeout and not recently accessed)
    // Sort by lastAccess to evict oldest idle connections first
    const idleConnections = [];
    for (const [key, entry] of this.cache.entries()) {
      // Never evict connections with active operations
      if (entry.activeOperations > 0) {
        continue;
      }

      const idleTime = now - entry.lastAccess;
      // Only evict if idle for longer than timeout AND not accessed in recent window
      // This prevents eviction of connections that were just retrieved
      if (
        idleTime > this.idleTimeoutMs &&
        idleTime > this.recentAccessWindowMs
      ) {
        idleConnections.push({ key, idleTime, refCount: entry.refCount || 0 });
      }
    }

    // Sort by idle time (most idle first), but prefer connections with lower refCount
    idleConnections.sort((a, b) => {
      // First sort by refCount (prefer evicting connections with lower refCount)
      if (a.refCount !== b.refCount) {
        return a.refCount - b.refCount;
      }
      // Then by idle time (most idle first)
      return b.idleTime - a.idleTime;
    });

    // Evict idle connections (limit to prevent too many evictions at once)
    const maxEvictions = Math.max(1, Math.floor(this.maxSize * 0.1)); // Evict up to 10% at once
    for (let i = 0; i < Math.min(idleConnections.length, maxEvictions); i++) {
      this._closeAndRemove(idleConnections[i].key, true);
    }
  }

  /**
   * Evict least recently used connection
   * Prefers connections that haven't been accessed recently (outside recent window)
   * IMPORTANT: Never evict connections with active operations (activeOperations > 0)
   * @private
   */
  _evictLRUConnection() {
    const now = Date.now();
    let lruKey = null;
    let lruTime = Infinity;
    let lruRefCount = Infinity;

    // Find LRU connection, preferring:
    // 1. Connections not accessed in recent window
    // 2. Connections with lower refCount (less frequently used)
    // 3. Oldest lastAccess time
    // IMPORTANT: Skip connections with active operations
    for (const [key, entry] of this.cache.entries()) {
      // Never evict connections with active operations
      if (entry.activeOperations > 0) {
        continue;
      }

      const isRecent = now - entry.lastAccess < this.recentAccessWindowMs;
      const refCount = entry.refCount || 0;

      // Prefer evicting connections outside recent window
      if (!isRecent) {
        // Among recent connections, prefer lower refCount, then older access
        if (refCount < lruRefCount || (refCount === lruRefCount && entry.lastAccess < lruTime)) {
          lruKey = key;
          lruTime = entry.lastAccess;
          lruRefCount = refCount;
        }
      } else if (!lruKey) {
        // Fallback: if no non-recent connection found, consider recent ones
        // but only if we haven't found any candidate yet
        if (refCount < lruRefCount || (refCount === lruRefCount && entry.lastAccess < lruTime)) {
          lruKey = key;
          lruTime = entry.lastAccess;
          lruRefCount = refCount;
        }
      }
    }

    // If still no candidate (shouldn't happen), evict oldest
    if (!lruKey) {
      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccess < lruTime) {
          lruKey = key;
          lruTime = entry.lastAccess;
        }
      }
    }

    if (lruKey) {
      this._closeAndRemove(lruKey, false);
    }
  }

  /**
   * Close and remove a connection from the pool
   * @param {string} key - Connection key to evict
   * @param {boolean} isProactive - Whether this is a proactive eviction
   * @private
   */
  _closeAndRemove(key, isProactive = false) {
    const entry = this.cache.get(key);
    if (entry && entry.value && entry.value.db) {
      try {
        entry.value.db.close();
      } catch (error) {
        // Log but don't throw - we still want to remove from cache
        logger.warn('Error closing database connection during pool eviction', {
          error: error.message,
          key,
          isProactive,
        });
      }
    }
    this.cache.delete(key);
    this.metrics.evictions++;
    if (isProactive) {
      this.metrics.proactiveEvictions++;
    }
    this.metrics.lastEvictionAt = new Date().toISOString();

    logger.verbose('Database pool eviction occurred', {
      poolSize: this.cache.size,
      maxSize: this.maxSize,
      evictedKey: key,
      isProactive,
      totalEvictions: this.metrics.evictions,
      proactiveEvictions: this.metrics.proactiveEvictions,
    });
  }

  /**
   * Check pool capacity and log warnings at thresholds
   * @param {number} previousSize - Previous pool size before this operation
   * @private
   */
  _checkCapacityWarnings(previousSize) {
    const currentSize = this.cache.size;
    const usagePercent = currentSize / this.maxSize;
    const previousPercent = previousSize / this.maxSize;

    // Only log if we crossed a threshold (to avoid spam)
    const now = Date.now();
    const lastWarningTime = this.metrics.lastWarningAt
      ? new Date(this.metrics.lastWarningAt).getTime()
      : 0;
    const timeSinceLastWarning = now - lastWarningTime;

    // Throttle warnings to at most once per minute
    const WARNING_THROTTLE_MS = 60000;

    if (
      usagePercent >= this.warningThresholds.emergency &&
      previousPercent < this.warningThresholds.emergency
    ) {
      if (timeSinceLastWarning >= WARNING_THROTTLE_MS) {
        logger.error('Database pool at EMERGENCY capacity - immediate action required', {
          poolSize: currentSize,
          maxSize: this.maxSize,
          usagePercent: (usagePercent * 100).toFixed(1) + '%',
          evictions: this.metrics.evictions,
          hits: this.metrics.hits,
          misses: this.metrics.misses,
        });
        this.metrics.lastWarningAt = new Date().toISOString();
      }
    } else if (
      usagePercent >= this.warningThresholds.critical &&
      previousPercent < this.warningThresholds.critical
    ) {
      if (timeSinceLastWarning >= WARNING_THROTTLE_MS) {
        logger.error('Database pool at CRITICAL capacity - pool exhaustion imminent', {
          poolSize: currentSize,
          maxSize: this.maxSize,
          usagePercent: (usagePercent * 100).toFixed(1) + '%',
          evictions: this.metrics.evictions,
          hits: this.metrics.hits,
          misses: this.metrics.misses,
        });
        this.metrics.lastWarningAt = new Date().toISOString();
      }
    } else if (
      usagePercent >= this.warningThresholds.warning &&
      previousPercent < this.warningThresholds.warning
    ) {
      if (timeSinceLastWarning >= WARNING_THROTTLE_MS) {
        logger.warn('Database pool approaching capacity - consider increasing MAX_DB_CONNECTIONS', {
          poolSize: currentSize,
          maxSize: this.maxSize,
          usagePercent: (usagePercent * 100).toFixed(1) + '%',
          evictions: this.metrics.evictions,
        });
        this.metrics.lastWarningAt = new Date().toISOString();
      }
    }
  }

  delete(key) {
    const entry = this.cache.get(key);
    if (entry && entry.value && entry.value.db) {
      try {
        entry.value.db.close();
      } catch (error) {
        // Log but don't throw - we still want to remove from cache
        logger.warn('Error closing database connection during deletion', { error: error.message });
      }
    }
    this.cache.delete(key);
  }

  clear() {
    for (const [key, entry] of this.cache) {
      if (entry && entry.value && entry.value.db) {
        try {
          entry.value.db.close();
        } catch (error) {
          // Log but don't throw - continue cleaning up other connections
          logger.warn('Error closing database connection during pool clear', {
            error: error.message,
          });
        }
      }
    }
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  /**
   * Get detailed pool statistics and metrics
   * @returns {Object} - Pool statistics
   */
  getStats() {
    const currentSize = this.cache.size;
    const usagePercent = (currentSize / this.maxSize) * 100;
    const totalRequests = this.metrics.hits + this.metrics.misses;
    const hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;

    // Count connections in use
    let inUseCount = 0;
    for (const entry of this.cache.values()) {
      if ((entry.refCount || 0) > 0) {
        inUseCount++;
      }
    }

    return {
      size: currentSize,
      maxSize: this.maxSize,
      usagePercent: parseFloat(usagePercent.toFixed(2)),
      available: this.maxSize - currentSize,
      inUse: inUseCount,
      idle: currentSize - inUseCount,
      metrics: {
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        evictions: this.metrics.evictions,
        proactiveEvictions: this.metrics.proactiveEvictions || 0,
        hitRate: parseFloat(hitRate.toFixed(2)),
        lastEvictionAt: this.metrics.lastEvictionAt,
        lastWarningAt: this.metrics.lastWarningAt,
      },
      status: this._getStatus(usagePercent),
    };
  }

  /**
   * Get status based on usage percentage
   * @param {number} usagePercent - Current usage percentage
   * @returns {string} - Status: 'healthy', 'warning', 'critical', 'emergency'
   * @private
   */
  _getStatus(usagePercent) {
    if (usagePercent >= this.warningThresholds.emergency * 100) {
      return 'emergency';
    } else if (usagePercent >= this.warningThresholds.critical * 100) {
      return 'critical';
    } else if (usagePercent >= this.warningThresholds.warning * 100) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      lastEvictionAt: null,
      lastWarningAt: null,
    };
  }
}

/**
 * Manages per-user SQLite databases with connection pooling
 */
class UserDatabaseManager {
  constructor(masterDb, userDbDir = '/app/data/users') {
    // masterDb can be either a Database instance or raw SQLite connection
    // If it has getQuery/allQuery/runQuery methods, it's a Database instance
    // Otherwise, it's a raw connection (for backward compatibility)
    this.masterDb = masterDb;
    this.masterDbIsInstance = typeof masterDb.getQuery === 'function';
    this.userDbDir = userDbDir;
    // Increased pool size for better scalability with 1000+ users
    this.pool = new DatabasePool(parseInt(process.env.MAX_DB_CONNECTIONS || '200'));
    // Mutex map to prevent race conditions when creating connections for the same user
    this.connectionLocks = new Map(); // Map<authId, Promise>
  }

  /**
   * Ensure user database directory exists (async)
   */
  async ensureUserDbDir() {
    try {
      await mkdir(this.userDbDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  /**
   * Get or create a user database connection
   * Uses mutex to prevent race conditions when multiple operations request the same user's connection
   * @param {string} authId - User authentication ID (API key hash)
   * @returns {Promise<Object>} - Database connection and migration runner
   */
  async getUserDatabase(authId) {
    if (!authId) {
      throw new Error('authId is required');
    }

    // Ensure user database directory exists
    await this.ensureUserDbDir();

    // Check pool first (fast path - no lock needed if connection exists)
    const cached = this.pool.get(authId);
    if (cached) {
      // Validate connection is still alive
      try {
        cached.db.prepare('SELECT 1').get();
        // Connection is valid - refCount was incremented by get()
        return cached;
      } catch (error) {
        // Connection is dead, remove from pool
        logger.warn('Cached database connection is stale, removing from pool', {
          authId,
          error: error.message,
        });
        this.pool.delete(authId);
        // Continue to create a new connection below (will use lock)
      }
    }

    // Check if another operation is already creating a connection for this user
    // This prevents race conditions where multiple calls create duplicate connections
    let connectionPromise = this.connectionLocks.get(authId);
    if (connectionPromise) {
      // Wait for the existing connection creation to complete
      try {
        return await connectionPromise;
      } catch (error) {
        // If the existing creation failed, we'll try again below
        this.connectionLocks.delete(authId);
      }
    }

    // Create a new connection (with mutex to prevent duplicates)
    connectionPromise = this._createUserDatabaseConnection(authId);
    this.connectionLocks.set(authId, connectionPromise);

    try {
      const connection = await connectionPromise;
      return connection;
    } finally {
      // Remove lock after connection is created (or fails)
      this.connectionLocks.delete(authId);
    }
  }

  /**
   * Internal method to create a user database connection
   * Should only be called from getUserDatabase() which handles locking
   * @param {string} authId - User authentication ID (API key hash)
   * @returns {Promise<Object>} - Database connection and migration runner
   * @private
   */
  async _createUserDatabaseConnection(authId) {
    // Double-check pool after acquiring lock (another thread might have created it)
    const cached = this.pool.get(authId);
    if (cached) {
      try {
        cached.db.prepare('SELECT 1').get();
        return cached;
      } catch (error) {
        // Connection is dead, remove and continue
        this.pool.delete(authId);
      }
    }

    // Get user registry entry (uses cache if available)
    let user;
    try {
      // Check cache first
      const cached = cache.getUserRegistry(authId);
      if (cached && cached.db_path) {
        user = cached;
      } else {
        // Query database using Database class methods or raw SQLite methods
        if (this.masterDbIsInstance) {
          user = this.masterDb.getQuery('SELECT db_path FROM user_registry WHERE auth_id = ?', [
            authId,
          ]);
        } else {
          user = this.masterDb
            .prepare('SELECT db_path FROM user_registry WHERE auth_id = ?')
            .get(authId);
        }

        // Cache the result if found (even if minimal, it helps avoid repeated queries)
        if (user) {
          cache.setUserRegistry(authId, user);
        }
      }
    } catch (error) {
      logger.error('Failed to get user registry info', error, { authId });
      throw error;
    }

    // If user not found in registry, check if they have an API key
    // This handles data inconsistency from before the foreign key fix
    if (!user) {
      let hasApiKey = false;
      try {
        if (this.masterDbIsInstance) {
          const apiKey = this.masterDb.getQuery(
            'SELECT auth_id FROM api_keys WHERE auth_id = ? AND is_active = 1',
            [authId]
          );
          hasApiKey = !!apiKey;
        } else {
          const apiKey = this.masterDb
            .prepare('SELECT auth_id FROM api_keys WHERE auth_id = ? AND is_active = 1')
            .get(authId);
          hasApiKey = !!apiKey;
        }
      } catch (error) {
        logger.warn('Failed to check for API key when user not found in registry', error, {
          authId,
        });
      }

      if (hasApiKey) {
        // User has API key but no registry entry - create it automatically
        // This fixes data inconsistency from before the foreign key constraint fix
        logger.info('User has API key but missing registry entry, creating it automatically', {
          authId,
        });
        const dbPath = path.join(this.userDbDir, `user_${authId}.sqlite`);
        try {
          if (this.masterDbIsInstance) {
            this.masterDb.runQuery(
              `
              INSERT OR IGNORE INTO user_registry (auth_id, db_path)
              VALUES (?, ?)
            `,
              [authId, dbPath]
            );
          } else {
            this.masterDb
              .prepare(
                `
              INSERT OR IGNORE INTO user_registry (auth_id, db_path)
              VALUES (?, ?)
            `
              )
              .run(authId, dbPath);
          }

          // Verify the user was inserted
          if (this.masterDbIsInstance) {
            user = this.masterDb.getQuery('SELECT db_path FROM user_registry WHERE auth_id = ?', [
              authId,
            ]);
          } else {
            user = this.masterDb
              .prepare('SELECT db_path FROM user_registry WHERE auth_id = ?')
              .get(authId);
          }

          if (user) {
            cache.setUserRegistry(authId, user);
            cache.invalidateActiveUsers();
            logger.info('Successfully created missing user registry entry', { authId, dbPath });
          } else {
            throw new Error('Failed to create user registry entry');
          }
        } catch (error) {
          logger.error('Failed to auto-create user registry entry', error, { authId, dbPath });
          throw new Error(
            `User ${authId} not found in registry and failed to create it automatically: ${error.message}`
          );
        }
      } else {
        // No API key either - user doesn't exist
        throw new Error(`User ${authId} not found in registry`);
      }
    }

    // Extract db_path
    const dbPath = user.db_path;

    // Ensure database file exists
    try {
      // Create parent directory if needed
      const dbDir = path.dirname(dbPath);
      try {
        await mkdir(dbDir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }

      // Create empty database file if it doesn't exist
      // We'll let SQLite create it, but ensure parent directory exists
    } catch (error) {
      logger.error('Failed to ensure database directory exists', error, { dbPath });
      throw error;
    }

    // Open database connection
    const db = new SQLiteDatabase(dbPath);

    // Enable WAL mode for better concurrency
    db.prepare('PRAGMA journal_mode = WAL').run();

    // Set busy timeout
    db.prepare('PRAGMA busy_timeout = 5000').run();

    // Enable foreign keys (required for CASCADE deletes to work)
    db.prepare('PRAGMA foreign_keys = ON').run();

    // Initialize migration runner for user database
    const migrationRunner = new MigrationRunner(db, 'user');
    await migrationRunner.runMigrations();

    const dbConnection = { db, migrationRunner, authId, dbPath };

    // Cache the connection (this will reuse existing if somehow one was created)
    this.pool.set(authId, dbConnection);

    return dbConnection;
  }

  /**
   * Register a new user and create their database
   * @param {string} apiKey - User's API key
   * @param {string} keyName - Optional name for the API key
   * @param {number} pollInterval - Optional polling interval in minutes (currently accepted but not stored; intervals are calculated dynamically)
   * @returns {Promise<string>} - authId of the created user
   */
  async registerUser(apiKey, keyName = null, pollInterval = null) {
    const authId = hashApiKey(apiKey);
    const dbPath = path.join(this.userDbDir, `user_${authId}.sqlite`);

    // Log pollInterval if provided (currently not stored; intervals are calculated dynamically)
    if (pollInterval !== null) {
      logger.debug('Poll interval provided during user registration', {
        authId,
        pollInterval,
        note: 'Intervals are calculated dynamically based on user activity and rules',
      });
    }

    // Check if user already exists
    let existing;
    if (this.masterDbIsInstance) {
      existing = this.masterDb.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [
        authId,
      ]);
    } else {
      existing = this.masterDb
        .prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?')
        .get(authId);
    }
    if (existing) {
      return authId;
    }

    // Insert into user registry using INSERT OR IGNORE to handle race conditions gracefully
    // This prevents errors if two requests try to register the same user simultaneously
    try {
      if (this.masterDbIsInstance) {
        this.masterDb.runQuery(
          `
          INSERT OR IGNORE INTO user_registry (auth_id, db_path)
          VALUES (?, ?)
        `,
          [authId, dbPath]
        );
      } else {
        this.masterDb
          .prepare(
            `
          INSERT OR IGNORE INTO user_registry (auth_id, db_path)
          VALUES (?, ?)
        `
          )
          .run(authId, dbPath);
      }

      // Verify the user was inserted or already exists (handle race conditions)
      // After INSERT OR IGNORE, check if user exists in registry
      const userAfterInsert = this.masterDbIsInstance
        ? this.masterDb.getQuery('SELECT auth_id, db_path FROM user_registry WHERE auth_id = ?', [
            authId,
          ])
        : this.masterDb
            .prepare('SELECT auth_id, db_path FROM user_registry WHERE auth_id = ?')
            .get(authId);

      if (!userAfterInsert) {
        // This shouldn't happen with INSERT OR IGNORE, but handle it gracefully
        logger.warn('User registration may have failed - user not found after insert', {
          authId,
          dbPath,
        });
        throw new Error(`Failed to register user: user not found in registry after insert`);
      }

      // If user already existed but db_path is different (e.g., placeholder from registerApiKey),
      // update it to the correct path
      if (userAfterInsert.db_path !== dbPath) {
        if (this.masterDbIsInstance) {
          this.masterDb.runQuery(
            `
            UPDATE user_registry 
            SET db_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE auth_id = ?
          `,
            [dbPath, authId]
          );
        } else {
          this.masterDb
            .prepare(
              `
            UPDATE user_registry 
            SET db_path = ?, updated_at = CURRENT_TIMESTAMP
            WHERE auth_id = ?
          `
            )
            .run(dbPath, authId);
        }
        logger.debug('Updated db_path for existing user registry entry', {
          authId,
          oldPath: userAfterInsert.db_path,
          newPath: dbPath,
        });
      }
    } catch (error) {
      // Handle constraint violations and other database errors
      const isConstraintError =
        error.code === 'SQLITE_CONSTRAINT' ||
        error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        error.message?.includes('UNIQUE constraint') ||
        error.message?.includes('constraint failed');

      if (isConstraintError) {
        // UNIQUE constraint violation - check if user was created by another request (race condition)
        const existingAfterError = this.masterDbIsInstance
          ? this.masterDb.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [authId])
          : this.masterDb
              .prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?')
              .get(authId);

        if (existingAfterError) {
          // User was created by another request (race condition), which is fine
          logger.debug('User already exists in registry (race condition handled)', { authId });
        } else {
          // Constraint error but user doesn't exist - unexpected state
          logger.error('UNIQUE constraint violation but user not found in registry', error, {
            authId,
            dbPath,
          });
          throw new Error(
            `Failed to register user: constraint violation but user not found in registry`
          );
        }
      } else {
        // Non-constraint error - check if user exists (might have been created by another request)
        const existingAfterError = this.masterDbIsInstance
          ? this.masterDb.getQuery('SELECT auth_id FROM user_registry WHERE auth_id = ?', [authId])
          : this.masterDb
              .prepare('SELECT auth_id FROM user_registry WHERE auth_id = ?')
              .get(authId);

        if (!existingAfterError) {
          // User still doesn't exist, re-throw the error
          logger.error('Failed to register user in registry', error, { authId, dbPath });
          throw error;
        }
        // User was created by another request (race condition), which is fine
        logger.debug('User already exists in registry (race condition handled)', { authId });
      }
    }

    // Invalidate cache since user registry changed
    cache.invalidateUserRegistry(authId);
    cache.invalidateActiveUsers();

    // Initialize the user database
    await this.getUserDatabase(authId);

    return authId;
  }

  /**
   * Get all active users
   * @returns {Array} - Array of user registry entries
   */
  getActiveUsers() {
    // Note: This method has a slightly different query than Database.getActiveUsers()
    // (includes OR ak.is_active IS NULL), so we use a different cache variant
    const variant = 'withNullKeys';

    // Check cache first
    const cached = cache.getActiveUsers(variant);
    if (cached !== undefined) {
      return cached;
    }

    // Query database if not cached
    let users;
    if (this.masterDbIsInstance) {
      users = this.masterDb.allQuery(`
        SELECT ur.*, ak.encrypted_key, ak.key_name
        FROM user_registry ur
        LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
        WHERE ur.status = 'active' AND (ak.is_active = 1 OR ak.is_active IS NULL)
        ORDER BY ur.created_at ASC
      `);
    } else {
      users = this.masterDb
        .prepare(
          `
        SELECT ur.*, ak.encrypted_key, ak.key_name
        FROM user_registry ur
        LEFT JOIN api_keys ak ON ur.auth_id = ak.auth_id
        WHERE ur.status = 'active' AND (ak.is_active = 1 OR ak.is_active IS NULL)
        ORDER BY ur.created_at ASC
      `
        )
        .all();
    }

    // Cache the result with variant
    cache.setActiveUsers(users, variant);
    return users;
  }

  /**
   * Delete a user and their database
   * @param {string} authId - User authentication ID
   */
  async deleteUser(authId) {
    // Get database path
    let user;
    if (this.masterDbIsInstance) {
      user = this.masterDb.getQuery('SELECT db_path FROM user_registry WHERE auth_id = ?', [
        authId,
      ]);
    } else {
      user = this.masterDb
        .prepare('SELECT db_path FROM user_registry WHERE auth_id = ?')
        .get(authId);
    }

    if (user) {
      // Close and remove from pool
      this.pool.delete(authId);

      // Delete database file
      try {
        await unlink(user.db_path);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('Failed to delete user database file', {
            authId,
            dbPath: user.db_path,
            error: error.message,
          });
        }
        // Continue even if file doesn't exist
      }
    }

    // Delete from registry (cascade will delete API keys)
    if (this.masterDbIsInstance) {
      this.masterDb.runQuery('DELETE FROM user_registry WHERE auth_id = ?', [authId]);
    } else {
      this.masterDb.prepare('DELETE FROM user_registry WHERE auth_id = ?').run(authId);
    }

    // Invalidate cache since user was deleted
    cache.invalidateUserRegistry(authId);
    cache.invalidateActiveUsers();
    cache.invalidateActiveRules(authId);
  }

  /**
   * Close all database connections
   */
  closeAll() {
    this.pool.clear();
  }

  /**
   * Get pool statistics with detailed metrics
   * @returns {Object} - Detailed pool statistics
   */
  getPoolStats() {
    return this.pool.getStats();
  }
}

export default UserDatabaseManager;
