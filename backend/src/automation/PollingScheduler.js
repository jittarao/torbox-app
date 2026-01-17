import UserPoller from './UserPoller.js';
import AutomationEngine from './AutomationEngine.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';

// Constants
const DEFAULT_POLL_CHECK_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_REFRESH_INTERVAL_MS = 60000; // 1 minute
const DEFAULT_POLL_TIMEOUT_MS = 300000; // 5 minutes
const DEFAULT_MAX_CONCURRENT_POLLS = 7;
const DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS = 24;
const ERROR_RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SKIPPED_POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_CYCLE_MULTIPLIER = 10; // Run cleanup every 10 poll cycles
const STAGGER_PERCENTAGE = 0.1; // 10% of base interval

/**
 * Semaphore utility for limiting concurrent operations
 */
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.running < this.maxConcurrent) {
        this.running++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      this.running++;
      const next = this.queue.shift();
      next();
    }
  }
}

/**
 * Mutex utility for per-user locking
 */
class Mutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve();
      });
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }

  isEmpty() {
    return !this.locked && this.queue.length === 0;
  }
}

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Error message for timeout
 * @returns {Promise} - Promise that rejects on timeout
 */
async function withTimeout(promise, timeoutMs, errorMessage) {
  let timeoutId;
  let timeoutOccurred = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timeoutOccurred = true;
      const timeoutError = new Error(errorMessage);
      timeoutError.name = 'TimeoutError';
      timeoutError.isTimeout = true;
      reject(timeoutError);
    }, timeoutMs);
  });

  const wrappedPromise = promise
    .then((result) => {
      if (timeoutId && !timeoutOccurred) {
        clearTimeout(timeoutId);
      }
      return result;
    })
    .catch((error) => {
      if (timeoutId && !timeoutOccurred) {
        clearTimeout(timeoutId);
        throw error;
      }
      throw error;
    });

  // Prevent unhandled rejections if promise rejects after timeout
  promise.catch((error) => {
    if (timeoutOccurred) {
      logger.debug(
        'Late promise rejection after timeout (suppressed to prevent unhandled rejection)',
        {
          error: error.message,
          timeoutMessage: errorMessage,
        }
      );
    }
  });

  try {
    return await Promise.race([wrappedPromise, timeoutPromise]);
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    throw error;
  }
}

/**
 * Polling Scheduler
 * Manages per-user polling cycles using cron-like approach
 */
class PollingScheduler {
  constructor(userDatabaseManager, masterDb, automationEnginesMap = null, options = {}) {
    this.userDatabaseManager = userDatabaseManager;
    this.masterDb = masterDb;
    this.automationEnginesMap = automationEnginesMap;
    this.pollers = new Map();
    this.isRunning = false;
    this.intervalId = null;
    this.refreshIntervalId = null;

    // Configuration
    this.pollCheckInterval = options.pollCheckInterval || DEFAULT_POLL_CHECK_INTERVAL_MS;
    this.refreshInterval = options.refreshInterval || DEFAULT_REFRESH_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS;
    this.maxConcurrentPolls = options.maxConcurrentPolls || DEFAULT_MAX_CONCURRENT_POLLS;
    this.pollerCleanupIntervalHours =
      options.pollerCleanupIntervalHours || DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS;

    // State
    this.lastCleanupAt = null;
    this.flagUpdateMutexes = new Map();
  }

  /**
   * Get or create a mutex for a specific user
   * @param {string} authId - User authentication ID
   * @returns {Mutex} Mutex instance
   */
  getMutex(authId) {
    let mutex = this.flagUpdateMutexes.get(authId);
    if (!mutex) {
      mutex = new Mutex();
      this.flagUpdateMutexes.set(authId, mutex);
    }
    return mutex;
  }

  /**
   * Atomically acquire a per-user lock and chain an operation to it
   * @param {string} authId - User authentication ID
   * @param {Function} operation - Async function to execute after acquiring lock
   * @returns {Promise} - Promise that resolves when the operation completes
   */
  async acquireLockAndExecute(authId, operation) {
    const mutex = this.getMutex(authId);
    await mutex.acquire();
    try {
      return await operation();
    } finally {
      mutex.release();
      // Clean up mutex if no longer needed
      if (mutex.isEmpty()) {
        this.flagUpdateMutexes.delete(authId);
      }
    }
  }

  /**
   * Get or create automation engine for a user
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<AutomationEngine>} Automation engine instance
   */
  async getOrCreateAutomationEngine(authId, encryptedKey) {
    if (this.automationEnginesMap && this.automationEnginesMap.has(authId)) {
      logger.debug('Using existing automation engine', { authId });
      return this.automationEnginesMap.get(authId);
    }

    logger.info('Creating new automation engine', { authId });
    const automationEngine = new AutomationEngine(
      authId,
      encryptedKey,
      this.userDatabaseManager,
      this.masterDb
    );
    await automationEngine.initialize();

    if (this.automationEnginesMap) {
      this.automationEnginesMap.set(authId, automationEngine);
    }

    return automationEngine;
  }

  /**
   * Create a poller for a user
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<UserPoller>} UserPoller instance
   */
  async createPoller(authId, encryptedKey) {
    logger.info('Creating poller for user', { authId });

    const userDb = await this.userDatabaseManager.getUserDatabase(authId);
    const automationEngine = await this.getOrCreateAutomationEngine(authId, encryptedKey);

    const poller = new UserPoller(
      authId,
      encryptedKey,
      userDb.db,
      automationEngine,
      this.masterDb,
      this.userDatabaseManager
    );

    poller.lastPolledAt = new Date();
    this.pollers.set(authId, poller);

    logger.info('Poller created successfully', { authId });
    return poller;
  }

  /**
   * Get or create a poller for a user
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<UserPoller>} UserPoller instance
   */
  async getOrCreatePoller(authId, encryptedKey) {
    let poller = this.pollers.get(authId);

    if (!poller) {
      poller = await this.createPoller(authId, encryptedKey);
    } else if (poller.lastPolledAt === null) {
      poller.lastPolledAt = new Date();
    }

    return poller;
  }

  /**
   * Update active rules flag in master DB
   * @param {string} authId - User authentication ID
   * @param {boolean} hasActiveRules - Whether user has active rules
   * @param {number} previousFlag - Previous flag value from DB
   */
  async updateActiveRulesFlag(authId, hasActiveRules, previousFlag) {
    await this.acquireLockAndExecute(authId, async () => {
      try {
        this.masterDb.updateActiveRulesFlag(authId, hasActiveRules);

        const newFlag = hasActiveRules ? 1 : 0;
        if (previousFlag !== newFlag) {
          logger.info('Synced active rules flag in master DB', {
            authId,
            previousFlag,
            newFlag,
            hasActiveRules,
          });
        }
      } catch (error) {
        logger.error('Failed to update active rules flag', error, {
          authId,
          hasActiveRules,
        });
        throw error;
      }
    });
  }

  /**
   * Handle poll timeout
   * @param {string} authId - User authentication ID
   * @param {number} duration - Poll duration in seconds
   */
  handlePollTimeout(authId, duration) {
    const nextPollAt = new Date(Date.now() + ERROR_RETRY_INTERVAL_MS);
    this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

    logger.info('Set next poll time after timeout', {
      authId,
      nextPollAt: nextPollAt.toISOString(),
      retryIn: '5 minutes',
      duration: `${duration.toFixed(2)}s`,
    });
  }

  /**
   * Handle poll error
   * @param {string} authId - User authentication ID
   * @param {Error} error - Error that occurred
   * @param {number} duration - Poll duration in seconds
   */
  handlePollError(authId, error, duration) {
    const nextPollAt = new Date(Date.now() + ERROR_RETRY_INTERVAL_MS);
    this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

    logger.info('Set next poll time after error', {
      authId,
      nextPollAt: nextPollAt.toISOString(),
      retryIn: '5 minutes',
      duration: `${duration.toFixed(2)}s`,
      errorMessage: error.message,
    });
  }

  /**
   * Handle successful poll result
   * @param {string} authId - User authentication ID
   * @param {UserPoller} poller - Poller instance
   * @param {Object} result - Poll result
   * @param {boolean} hasActiveRules - Whether user has active rules
   * @param {number} duration - Poll duration in seconds
   */
  async handleSuccessfulPoll(authId, poller, result, hasActiveRules, duration) {
    const nextPollAt = await poller.calculateNextPollAt(
      result.nonTerminalCount || 0,
      hasActiveRules,
      (authId, baseIntervalMinutes) => this.calculateStaggerOffset(authId, baseIntervalMinutes),
      result.ruleResults || null
    );

    this.masterDb.updateNextPollAt(authId, nextPollAt, result.nonTerminalCount || 0);

    logger.info('Poll completed successfully', {
      authId,
      duration: `${duration.toFixed(2)}s`,
      rulesEvaluated: result.ruleResults?.evaluated || 0,
      rulesExecuted: result.ruleResults?.executed || 0,
      nonTerminalCount: result.nonTerminalCount || 0,
      nextPollAt: nextPollAt.toISOString(),
      changes: result.changes
        ? {
            new: result.changes.new?.length || 0,
            updated: result.changes.updated?.length || 0,
            removed: result.changes.removed?.length || 0,
          }
        : null,
    });
  }

  /**
   * Handle skipped poll result
   * @param {string} authId - User authentication ID
   * @param {Object} result - Poll result
   * @param {number} duration - Poll duration in seconds
   */
  handleSkippedPoll(authId, result, duration) {
    const nextPollAt = new Date(Date.now() + SKIPPED_POLL_INTERVAL_MS);
    this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

    logger.info('Poll skipped - no active rules', {
      authId,
      reason: result.reason || 'No active automation rules',
      duration: `${duration.toFixed(2)}s`,
      nextPollAt: nextPollAt.toISOString(),
    });
  }

  /**
   * Execute poll for a single user
   * @param {Object} user - User object from database
   * @param {Semaphore} semaphore - Semaphore for concurrency control
   * @param {Object} counters - Object to track success/skipped/error counts
   * @returns {Promise<void>}
   */
  async executeUserPoll(user, semaphore, counters) {
    await semaphore.acquire();
    const pollStartTime = Date.now();

    try {
      const { auth_id, encrypted_key, has_active_rules: dbHasActiveRules } = user;

      if (!encrypted_key) {
        logger.warn('User has no API key, skipping poll', {
          authId: auth_id,
          hasActiveRules: dbHasActiveRules,
        });
        counters.error++;
        return;
      }

      const poller = await this.getOrCreatePoller(auth_id, encrypted_key);
      const hasActiveRules = poller.automationEngine
        ? await poller.automationEngine.hasActiveRules()
        : false;

      // Log flag mismatch if detected
      if (dbHasActiveRules !== (hasActiveRules ? 1 : 0)) {
        logger.warn('Active rules flag mismatch detected, will sync after poll', {
          authId: auth_id,
          dbFlag: dbHasActiveRules,
          actualState: hasActiveRules,
        });
      }

      logger.debug('Starting poll for user', {
        authId: auth_id,
        hasActiveRules,
        dbHasActiveRules,
      });

      // Execute poll with timeout
      let result;
      try {
        result = await withTimeout(
          poller.poll(hasActiveRules),
          this.pollTimeoutMs,
          `Poll timeout after ${this.pollTimeoutMs / 1000}s`
        );
      } catch (error) {
        if (error.isTimeout || error.name === 'TimeoutError' || error.message.includes('timeout')) {
          const duration = (Date.now() - pollStartTime) / 1000;
          logger.error('Poll timeout exceeded', error, {
            authId: auth_id,
            timeoutMs: this.pollTimeoutMs,
            duration: `${duration.toFixed(2)}s`,
          });
          this.handlePollTimeout(auth_id, duration);
          counters.error++;
          return;
        }
        throw error;
      }

      const duration = (Date.now() - pollStartTime) / 1000;

      // Update active rules flag if needed
      if (poller.automationEngine) {
        await this.updateActiveRulesFlag(auth_id, hasActiveRules, dbHasActiveRules);
      }

      // Handle poll result
      if (result && result.success && !result.skipped) {
        await this.handleSuccessfulPoll(auth_id, poller, result, hasActiveRules, duration);
        counters.success++;
      } else if (result && result.skipped) {
        this.handleSkippedPoll(auth_id, result, duration);
        counters.skipped++;
      } else {
        logger.warn('Poll returned unexpected result', {
          authId: auth_id,
          result,
          duration: `${duration.toFixed(2)}s`,
        });
        counters.error++;
      }
    } catch (error) {
      const duration = (Date.now() - pollStartTime) / 1000;
      logger.error('Error polling user', error, {
        authId: user.auth_id,
        duration: `${duration.toFixed(2)}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      this.handlePollError(user.auth_id, error, duration);
      counters.error++;
    } finally {
      semaphore.release();
    }
  }

  /**
   * Start the scheduler (cron-like approach)
   */
  async start() {
    if (this.isRunning) {
      logger.warn('PollingScheduler already running, ignoring start request');
      return;
    }

    logger.info('Starting PollingScheduler (cron-like mode)', {
      pollCheckInterval: `${this.pollCheckInterval / 1000}s`,
      refreshInterval: `${this.refreshInterval / 1000}s`,
      timestamp: new Date().toISOString(),
    });

    this.isRunning = true;

    // Initial load of active users
    logger.info('Performing initial poller refresh');
    await this.refreshPollers();

    // Start periodic check for users due for polling
    this.intervalId = setInterval(() => {
      this.pollDueUsers()
        .catch((err) => {
          logger.error('Unhandled error in pollDueUsers interval', err, {
            errorMessage: err.message,
            errorStack: err.stack,
          });
        })
        .catch(() => {
          console.error('Critical: Failed to log interval error');
        });
    }, this.pollCheckInterval);

    logger.info('Polling scheduler started successfully', {
      pollCheckInterval: `${this.pollCheckInterval / 1000}s`,
      refreshInterval: `${this.refreshInterval / 1000}s`,
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    // Start periodic check for new users
    this.refreshIntervalId = setInterval(() => {
      this.refreshPollers()
        .catch((err) => {
          logger.error('Unhandled error in refreshPollers interval', err, {
            errorMessage: err.message,
            errorStack: err.stack,
          });
        })
        .catch(() => {
          console.error('Critical: Failed to log interval error');
        });
    }, this.refreshInterval);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.debug('PollingScheduler not running, ignoring stop request');
      return;
    }

    logger.info('Stopping PollingScheduler', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.debug('Polling interval cleared');
    }

    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
      logger.debug('Refresh interval cleared');
    }

    const pollerCount = this.pollers.size;
    this.pollers.clear();

    logger.info('PollingScheduler stopped', {
      clearedPollers: pollerCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate stagger offset for a user based on authId hash
   * Spreads users across 10% of base interval to prevent simultaneous polling
   * @param {string} authId - User authentication ID
   * @param {number} baseIntervalMinutes - Base polling interval in minutes
   * @returns {number} - Stagger offset in milliseconds
   */
  calculateStaggerOffset(authId, baseIntervalMinutes) {
    let hash = 0;
    for (let i = 0; i < authId.length; i++) {
      const char = authId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    const normalizedHash = Math.abs(hash % 100) / 100;
    const baseIntervalMs = baseIntervalMinutes * 60 * 1000;
    return normalizedHash * baseIntervalMs * STAGGER_PERCENTAGE;
  }

  /**
   * Clean up pollers that haven't been polled recently
   * @returns {number} Number of pollers cleaned up
   */
  cleanupStalePollers() {
    const now = Date.now();
    const cleanupThresholdMs = this.pollerCleanupIntervalHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [authId, poller] of this.pollers.entries()) {
      const lastPolledAt = poller.lastPolledAt;
      if (!lastPolledAt) {
        continue;
      }

      const timeSinceLastPoll = now - new Date(lastPolledAt).getTime();
      if (timeSinceLastPoll > cleanupThresholdMs) {
        logger.info('Removing stale poller (not polled recently)', {
          authId,
          lastPolledAt: lastPolledAt.toISOString(),
          hoursSinceLastPoll: (timeSinceLastPoll / (60 * 60 * 1000)).toFixed(2),
          thresholdHours: this.pollerCleanupIntervalHours,
        });
        this.pollers.delete(authId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Poller cleanup completed', {
        cleanedCount,
        remainingPollers: this.pollers.size,
      });
    }

    this.lastCleanupAt = new Date();
    return cleanedCount;
  }

  /**
   * Check if cleanup should run
   * @returns {boolean} True if cleanup should run
   */
  shouldRunCleanup() {
    if (!this.lastCleanupAt) {
      return true;
    }
    const timeSinceCleanup = Date.now() - new Date(this.lastCleanupAt).getTime();
    return timeSinceCleanup > CLEANUP_CYCLE_MULTIPLIER * this.pollCheckInterval;
  }

  /**
   * Poll users that are due for polling (cron-like)
   */
  async pollDueUsers() {
    if (!this.isRunning) {
      logger.verbose('Polling scheduler not running, skipping poll check');
      return;
    }

    if (this.shouldRunCleanup()) {
      this.cleanupStalePollers();
    }

    const checkStartTime = Date.now();
    logger.verbose('Checking for users due for polling', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    try {
      const dueUsers = this.masterDb.getUsersDueForPolling();

      if (dueUsers.length === 0) {
        logger.verbose('No users due for polling at this time', {
          checkDuration: `${((Date.now() - checkStartTime) / 1000).toFixed(2)}s`,
        });
        return;
      }

      logger.info('Found users due for polling', {
        count: dueUsers.length,
        authIds: dueUsers.map((u) => u.auth_id),
        hasActiveRulesFlags: dueUsers.map((u) => ({
          authId: u.auth_id,
          hasActiveRules: u.has_active_rules,
        })),
      });

      const counters = { success: 0, skipped: 0, error: 0 };
      const semaphore = new Semaphore(this.maxConcurrentPolls);

      await Promise.all(dueUsers.map((user) => this.executeUserPoll(user, semaphore, counters)));

      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.info('Poll cycle completed', {
        totalUsers: dueUsers.length,
        successCount: counters.success,
        skippedCount: counters.skipped,
        errorCount: counters.error,
        totalDuration: `${totalDuration}s`,
        averageDuration:
          dueUsers.length > 0 ? `${(totalDuration / dueUsers.length).toFixed(2)}s` : '0s',
      });
    } catch (error) {
      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.error('Error in pollDueUsers', error, {
        duration: `${totalDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
    }
  }

  /**
   * Refresh pollers based on active users
   * Ensures pollers exist for users with active rules
   * First syncs the has_active_rules flag for all active users to ensure accuracy
   */
  async refreshPollers() {
    const refreshStartTime = Date.now();
    logger.debug('Refreshing pollers', {
      currentPollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    try {
      const activeUsers = this.userDatabaseManager.getActiveUsers();
      const currentAuthIds = new Set(this.pollers.keys());

      logger.debug('Active users found', {
        activeUserCount: activeUsers.length,
        currentPollerCount: this.pollers.size,
      });

      // Step 1: Sync has_active_rules flag for all active users
      // This ensures the flag accurately reflects the actual state in user databases
      // Optimized: Directly query user databases instead of creating engines
      const syncStats = { synced: 0, errors: 0, skipped: 0 };
      for (const user of activeUsers) {
        const { auth_id, encrypted_key, has_active_rules: dbFlag } = user;

        if (!encrypted_key) {
          continue; // Skip users without API keys
        }

        try {
          // Optimization: Use existing engine if available, otherwise query DB directly
          let actualHasActiveRules = false;
          let automationEngine = null;

          if (this.automationEnginesMap && this.automationEnginesMap.has(auth_id)) {
            // Engine already exists - use it (fast path)
            automationEngine = this.automationEnginesMap.get(auth_id);
            actualHasActiveRules = await automationEngine.hasActiveRules();
          } else {
            // Engine doesn't exist - query database directly (avoids expensive initialization)
            const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
            if (userDb && userDb.db) {
              const result = userDb.db
                .prepare('SELECT COUNT(*) as count FROM automation_rules WHERE enabled = 1')
                .get();
              actualHasActiveRules = result && result.count > 0;
            } else {
              // Database doesn't exist or can't be accessed - skip
              syncStats.skipped++;
              continue;
            }
          }

          const actualFlag = actualHasActiveRules ? 1 : 0;

          // Sync flag if it's out of sync
          if (dbFlag !== actualFlag) {
            logger.info('Syncing active rules flag during poller refresh', {
              authId: auth_id,
              previousFlag: dbFlag,
              actualFlag,
              actualHasActiveRules,
            });

            // Use existing engine if available, otherwise create one just for syncing
            if (!automationEngine) {
              automationEngine = await this.getOrCreateAutomationEngine(auth_id, encrypted_key);
            }
            await automationEngine.syncActiveRulesFlag();
            syncStats.synced++;
          }
        } catch (error) {
          logger.warn('Failed to sync active rules flag for user', {
            authId: auth_id,
            errorMessage: error.message,
          });
          syncStats.errors++;
        }
      }

      // Step 2: Refresh active users list after syncing flags (to get updated flags)
      // Invalidate cache to ensure we get fresh data
      cache.invalidateActiveUsers();
      const refreshedActiveUsers = this.userDatabaseManager.getActiveUsers();
      const usersWithActiveRules = refreshedActiveUsers.filter(
        (user) => user.has_active_rules === 1
      );

      logger.debug('Active users after flag sync', {
        activeUserCount: refreshedActiveUsers.length,
        usersWithActiveRulesCount: usersWithActiveRules.length,
        flagsSynced: syncStats.synced,
        syncErrors: syncStats.errors,
        skipped: syncStats.skipped,
      });

      const stats = { added: 0, removed: 0, error: 0 };

      // Step 3: Create pollers for users with active rules
      for (const user of usersWithActiveRules) {
        const { auth_id, encrypted_key } = user;

        if (!encrypted_key) {
          logger.warn('User has no API key, skipping poller creation', {
            authId: auth_id,
          });
          stats.error++;
          continue;
        }

        if (!this.pollers.has(auth_id)) {
          try {
            await this.createPoller(auth_id, encrypted_key);
            const automationEngine = await this.getOrCreateAutomationEngine(auth_id, encrypted_key);
            logger.info('Poller added successfully', {
              authId: auth_id,
              hasActiveRules: await automationEngine.hasActiveRules(),
            });
            stats.added++;
          } catch (error) {
            logger.error('Failed to create poller for user', error, {
              authId: auth_id,
              errorMessage: error.message,
              errorStack: error.stack,
            });
            stats.error++;
          }
        }
      }

      // Step 4: Remove pollers for users without active rules
      for (const authId of currentAuthIds) {
        const userStillHasActiveRules = usersWithActiveRules.some((u) => u.auth_id === authId);
        if (!userStillHasActiveRules) {
          this.pollers.delete(authId);
          logger.info('Removed poller for user without active rules', {
            authId,
          });
          stats.removed++;
        }
      }

      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      logger.info('Poller refresh completed', {
        activeUsers: activeUsers.length,
        addedCount: stats.added,
        removedCount: stats.removed,
        errorCount: stats.error,
        totalPollers: this.pollers.size,
        duration: `${refreshDuration}s`,
      });
    } catch (error) {
      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      logger.error('Error refreshing pollers', error, {
        duration: `${refreshDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Status object
   */
  getStatus() {
    const pollerStatuses = Array.from(this.pollers.entries()).map(([authId, poller]) => ({
      authId,
      ...poller.getStatus(),
    }));

    return {
      isRunning: this.isRunning,
      activePollers: this.pollers.size,
      pollers: pollerStatuses,
    };
  }

  /**
   * Manually trigger a poll for a specific user
   * @param {string} authId - User authentication ID
   * @returns {Promise<Object>} Poll result
   */
  async triggerPoll(authId) {
    logger.info('Manually triggering poll for user', {
      authId,
      timestamp: new Date().toISOString(),
    });

    const poller = this.pollers.get(authId);
    if (!poller) {
      logger.error('No poller found for user', {
        authId,
        availablePollers: Array.from(this.pollers.keys()),
      });
      throw new Error(`No poller found for user ${authId}`);
    }

    try {
      const result = await withTimeout(
        poller.poll(),
        this.pollTimeoutMs,
        `Manual poll timeout after ${this.pollTimeoutMs / 1000}s`
      );

      logger.info('Manual poll completed', {
        authId,
        success: result.success,
        skipped: result.skipped,
        rulesEvaluated: result.ruleResults?.evaluated || 0,
        rulesExecuted: result.ruleResults?.executed || 0,
      });

      return result;
    } catch (error) {
      if (error.isTimeout || error.name === 'TimeoutError' || error.message.includes('timeout')) {
        logger.error('Manual poll timeout exceeded', error, {
          authId,
          timeoutMs: this.pollTimeoutMs,
        });
      } else {
        logger.error('Manual poll failed', error, {
          authId,
          errorMessage: error.message,
        });
      }
      throw error;
    }
  }
}

export default PollingScheduler;
