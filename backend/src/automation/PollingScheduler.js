import UserPoller from './UserPoller.js';
import AutomationEngine from './AutomationEngine.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import Semaphore from '../utils/semaphore.js';

// Constants
const DEFAULT_POLL_CHECK_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_FULL_SYNC_EVERY_N = 6; // Do expensive "sync has_active_rules from all user DBs" every N refreshes (~90 min at 15 min refresh)
// Minimum time between polling the same user (each user must not be polled more than once per this window)
const MIN_POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — minimum time between polling the same user
// Per-user kick-out: max time one user's poll may run inside a cycle before we give up and free the slot
const DEFAULT_POLL_KICKOUT_MS = 180000; // 3 minutes — allows slow API/DB for users with many torrents; set POLL_KICKOUT_MS=120000 for stricter slot usage
const DEFAULT_MAX_CONCURRENT_POLLS = 12; // Number of users polled in parallel
const DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS = 24;
const ERROR_RETRY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes after error or first timeout
const TIMEOUT_BACKOFF_RETRY_MS = 60 * 60 * 1000; // 60 minutes after repeated timeouts (free concurrency slot)
const SKIPPED_POLL_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours when user has no active rules
const CLEANUP_CYCLE_MULTIPLIER = 10; // Run cleanup every 10 poll cycles
const STAGGER_PERCENTAGE = 0.1; // 10% of base interval
const SLOW_POLL_WARNING_PERCENT = 0.8; // Log when poll has run this fraction of per-user timeout

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

/** Max action batches run in parallel (each batch uses RULE_ACTION_CONCURRENCY API calls) */
const GLOBAL_ACTION_QUEUE_CONCURRENCY = Math.min(
  8,
  Math.max(1, parseInt(process.env.GLOBAL_ACTION_QUEUE_CONCURRENCY || '4', 10))
);

/**
 * Cross-user action queue: drains pending rule actions in the background so the next tick's
 * fetch phase is not blocked. Uses ApiClient's action semaphore internally when executing.
 */
class GlobalActionQueue {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.pending = [];
    this.draining = false;
  }

  enqueue(descriptors) {
    if (!Array.isArray(descriptors) || descriptors.length === 0) return;
    this.pending.push(...descriptors);
    this.drain().catch((err) => {
      logger.error('GlobalActionQueue drain error', err, {
        errorMessage: err.message,
        pendingCount: this.pending.length,
      });
    });
  }

  async drain() {
    if (this.draining || this.pending.length === 0) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const batch = this.pending.splice(0, GLOBAL_ACTION_QUEUE_CONCURRENCY);
        await Promise.allSettled(
          batch.map((d) => this.scheduler.runActionBatch(d))
        );
      }
    } finally {
      this.draining = false;
    }
  }
}

/**
 * Polling Scheduler
 * Manages per-user polling cycles using cron-like approach
 */
class PollingScheduler {
  constructor(userDatabaseManager, masterDb, automationEnginesMap = null, options = {}) {
    if (!userDatabaseManager) {
      throw new Error('userDatabaseManager is required for PollingScheduler');
    }
    if (!masterDb) {
      throw new Error('masterDb is required for PollingScheduler');
    }

    this.userDatabaseManager = userDatabaseManager;
    this.masterDb = masterDb;
    this.automationEnginesMap = automationEnginesMap;
    this.pollers = new Map();
    this.isRunning = false;
    this.intervalId = null;
    this.refreshIntervalId = null;

    // Configuration with validation
    this.pollCheckInterval = Math.max(
      1000,
      options.pollCheckInterval || DEFAULT_POLL_CHECK_INTERVAL_MS
    );
    this.refreshInterval = Math.max(
      60 * 1000,
      options.refreshInterval ??
        parseInt(process.env.REFRESH_INTERVAL_MS || String(DEFAULT_REFRESH_INTERVAL_MS), 10)
    );
    this.pollKickoutMs = Math.max(
      1000,
      options.pollKickoutMs ?? options.pollTimeoutMs ?? parseInt(process.env.POLL_KICKOUT_MS || String(DEFAULT_POLL_KICKOUT_MS), 10)
    );
    this.maxConcurrentPolls = Math.max(
      1,
      options.maxConcurrentPolls || DEFAULT_MAX_CONCURRENT_POLLS
    );
    this.pollerCleanupIntervalHours = Math.max(
      1,
      options.pollerCleanupIntervalHours || DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS
    );

    // State
    this.lastCleanupAt = null;
    this.flagUpdateMutexes = new Map();
    /** Cached AutomationEngine per user — avoids re-running initialize() (4-5 DB queries) on every poll */
    this.cachedEngines = new Map();
    /** @type {Map<string, number>} Consecutive timeout count per user; used for backoff so repeat timeouts don't hold slots */
    this.userConsecutiveTimeoutCount = new Map();
    /** Single semaphore shared across all poll cycles so we never exceed maxConcurrentPolls globally */
    this.pollSemaphore = null;
    this._pollCycleInProgress = false;
    this._refreshInProgress = false;
    this._refreshCount = 0; // Incremented each refresh; full sync every REFRESH_FULL_SYNC_EVERY_N
    this._refreshSyncConcurrency = Math.min(
      20,
      Math.max(1, parseInt(process.env.REFRESH_SYNC_CONCURRENCY || '5', 10))
    );

    // Metrics
    this.metrics = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      skippedPolls: 0,
      timeoutPolls: 0,
      lastPollAt: null,
    };
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
   * Get or create an automation engine for a poll cycle.
   * Engines are cached per-user so that initialize() (4-5 DB queries) only runs once instead
   * of on every poll. On subsequent polls the engine's DB connection is refreshed via
   * getRuleEvaluator(). The cached engine is discarded when the poller is removed.
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<AutomationEngine>} Automation engine instance
   */
  async createEngineForPoll(authId, encryptedKey) {
    const cached = this.cachedEngines.get(authId);
    if (cached?.isInitialized) {
      // Refresh the rule evaluator's DB connection for this poll cycle without re-initializing
      await cached.getRuleEvaluator();
      return cached;
    }

    const engine = new AutomationEngine(
      authId,
      encryptedKey,
      this.userDatabaseManager,
      this.masterDb
    );
    await engine.initialize();
    this.cachedEngines.set(authId, engine);
    return engine;
  }

  /**
   * Create a poller for a user. The engine is managed separately in cachedEngines and attached
   * at poll time via createEngineForPoll().
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<UserPoller>} UserPoller instance
   */
  async createPoller(authId, encryptedKey) {
    if (!authId) {
      throw new Error('authId is required for createPoller');
    }
    if (!encryptedKey) {
      throw new Error('encryptedKey is required for createPoller');
    }

    logger.info('Creating poller for user', { authId });

    try {
      const poller = new UserPoller(
        authId,
        encryptedKey,
        null, // connection acquired at poll time and released after each poll
        null, // engine is attached from cachedEngines just before each poll and detached after
        this.masterDb,
        this.userDatabaseManager
      );

      poller.lastPolledAt = new Date();
      this.pollers.set(authId, poller);

      logger.info('Poller created successfully', { authId });
      return poller;
    } catch (error) {
      logger.error('Failed to create poller', error, {
        authId,
        errorMessage: error.message,
      });
      throw error;
    }
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
    if (!authId) {
      logger.warn('handlePollTimeout called with invalid authId');
      return;
    }

    try {
      const count = (this.userConsecutiveTimeoutCount.get(authId) || 0) + 1;
      this.userConsecutiveTimeoutCount.set(authId, count);
      const retryMs =
        count >= 2 ? TIMEOUT_BACKOFF_RETRY_MS : ERROR_RETRY_INTERVAL_MS;
      const nextPollAt = new Date(Date.now() + retryMs);
      this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

      this.metrics.timeoutPolls++;
      this.metrics.failedPolls++;

      logger.info('Set next poll time after per-user timeout', {
        authId,
        nextPollAt: nextPollAt.toISOString(),
        retryIn: count >= 2 ? '60 minutes (backoff)' : '30 minutes',
        consecutiveTimeouts: count,
        duration: `${duration.toFixed(2)}s`,
      });
    } catch (error) {
      logger.error('Failed to handle poll timeout', error, {
        authId,
        duration,
        errorMessage: error.message,
      });
    }
  }

  /**
   * Handle a poll that was aborted because TorBox API was unreachable (network failure / 5xx).
   * Shadow state was NOT touched, so we simply schedule a fast retry and avoid penalising the
   * user's consecutive-timeout counter (this is an external outage, not a runaway poll).
   * @param {string} authId - User authentication ID
   * @param {number} duration - Poll duration in seconds
   */
  handleConnectionError(authId, duration) {
    if (!authId) {
      logger.warn('handleConnectionError called with invalid authId');
      return;
    }

    try {
      // Retry in ERROR_RETRY_INTERVAL_MS (30 min). The reserveUntil written at poll start is
      // already 30 min from now, so this is a no-op in the common case — but it makes intent
      // explicit and covers edge cases where the poll finished quickly.
      const nextPollAt = new Date(Date.now() + ERROR_RETRY_INTERVAL_MS);
      this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

      this.metrics.failedPolls++;

      logger.warn('Poll aborted: TorBox API unreachable — scheduling fast retry', {
        authId,
        nextPollAt: nextPollAt.toISOString(),
        retryIn: '30 minutes',
        duration: `${duration.toFixed(2)}s`,
      });
    } catch (error) {
      logger.error('Failed to handle connection error for poll', error, {
        authId,
        duration,
        errorMessage: error.message,
      });
    }
  }

  /**
   * Handle poll error
   * @param {string} authId - User authentication ID
   * @param {Error} error - Error that occurred
   * @param {number} duration - Poll duration in seconds
   */
  handlePollError(authId, error, duration) {
    if (!authId) {
      logger.warn('handlePollError called with invalid authId');
      return;
    }

    try {
      const nextPollAt = new Date(Date.now() + ERROR_RETRY_INTERVAL_MS);
      this.masterDb.updateNextPollAt(authId, nextPollAt, 0);

      this.metrics.failedPolls++;

      logger.info('Set next poll time after error', {
        authId,
        nextPollAt: nextPollAt.toISOString(),
        retryIn: '30 minutes',
        duration: `${duration.toFixed(2)}s`,
        errorMessage: error?.message || 'Unknown error',
        errorName: error?.name,
      });
    } catch (dbError) {
      logger.error('Failed to handle poll error', dbError, {
        authId,
        originalError: error?.message,
        duration,
        errorMessage: dbError.message,
      });
    }
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
    this.userConsecutiveTimeoutCount.delete(authId);
    const nextPollAt = result.nextPollAt;

    // Scheduler is the single source of truth for next_poll_at on success (poller called with updateMasterDb: false)
    if (nextPollAt != null) {
      this.masterDb.updateNextPollAt(authId, nextPollAt, result.nonTerminalCount ?? 0);
    }

    logger.info('Poll completed successfully', {
      authId,
      duration: `${duration.toFixed(2)}s`,
      rulesEvaluated: result.ruleResults?.evaluated || 0,
      rulesExecuted: result.ruleResults?.executed || 0,
      nonTerminalCount: result.nonTerminalCount || 0,
      nextPollAt: nextPollAt?.toISOString() || 'unknown',
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
   * Execute poll for a single user.
   * Each user has a per-user kick-out timeout (pollKickoutMs); one slow poll gets kicked out and cannot block others.
   * @param {Object} user - User object from database
   * @param {Semaphore} semaphore - Semaphore for concurrency control (maxConcurrentPolls)
   * @param {Object} counters - Object to track success/skipped/error counts
   * @returns {Promise<void>}
   */
  async executeUserPoll(user, semaphore, counters) {
    if (!user || !user.auth_id) {
      logger.warn('executeUserPoll called with invalid user object', {
        user: user ? Object.keys(user) : 'null',
      });
      counters.error++;
      return;
    }

    await semaphore.acquire();
    const pollStartTime = Date.now();
    let engineForPoll = null;

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

      const reserveUntil = new Date(Date.now() + MIN_POLL_INTERVAL_MS);
      this.masterDb.updateNextPollAt(auth_id, reserveUntil, 0);

      const poller = await this.getOrCreatePoller(auth_id, encrypted_key);

      // Create engine for this poll only (not cached)
      engineForPoll = await this.createEngineForPoll(auth_id, encrypted_key);
      poller.automationEngine = engineForPoll;

      const hasActiveRules = await engineForPoll.hasActiveRules();

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

      // Warn when poll runs a long time (before timeout) so operators can tune POLL_TIMEOUT_MS or investigate
      const slowPollThresholdMs = Math.floor(this.pollKickoutMs * SLOW_POLL_WARNING_PERCENT);
      const slowPollWarningTimer = setTimeout(() => {
        const elapsed = ((Date.now() - pollStartTime) / 1000).toFixed(1);
        logger.warn('Poll still running (approaching per-user timeout)', {
          authId: auth_id,
          elapsedSeconds: elapsed,
          perUserTimeoutMs: this.pollKickoutMs,
          percentOfTimeout: Math.round(SLOW_POLL_WARNING_PERCENT * 100),
        });
      }, slowPollThresholdMs);

      // Per-user timeout: this user only; other users are unaffected
      let result;
      try {
        result = await withTimeout(
          poller.poll(hasActiveRules, {
            calculateStaggerOffset: (pollAuthId, baseIntervalMinutes) =>
              this.calculateStaggerOffset(pollAuthId, baseIntervalMinutes),
            updateMasterDb: false, // Scheduler persists next_poll_at in handleSuccessfulPoll
          }),
          this.pollKickoutMs,
          `Per-user poll timeout after ${this.pollKickoutMs / 1000}s`
        );
      } catch (error) {
        if (error.isTimeout || error.name === 'TimeoutError' || error.message.includes('timeout')) {
          const duration = (Date.now() - pollStartTime) / 1000;
          logger.error('Per-user poll timeout exceeded (kicking user out of concurrency slot)', error, {
            authId: auth_id,
            perUserTimeoutMs: this.pollKickoutMs,
            duration: `${duration.toFixed(2)}s`,
          });
          this.handlePollTimeout(auth_id, duration);
          poller.resetPollingState();
          counters.error++;
          // return then finally: semaphore.release() frees the slot for the next due user
          return;
        }
        throw error;
      } finally {
        clearTimeout(slowPollWarningTimer);
      }

      const duration = (Date.now() - pollStartTime) / 1000;

      // Update active rules flag if needed
      await this.updateActiveRulesFlag(auth_id, hasActiveRules, dbHasActiveRules);

      // Handle poll result
      if (result && result.success && !result.skipped) {
        await this.handleSuccessfulPoll(auth_id, poller, result, hasActiveRules, duration);
        counters.success++;
        this.metrics.successfulPolls++;
        this.metrics.lastPollAt = new Date();
      } else if (result && result.skipped) {
        this.handleSkippedPoll(auth_id, result, duration);
        counters.skipped++;
        this.metrics.skippedPolls++;
      } else if (result && result.isConnectionError) {
        // TorBox API was unreachable — shadow state is intact, retry in 30 min
        this.handleConnectionError(auth_id, duration);
        counters.error++;
      } else {
        logger.warn('Poll returned unexpected result', {
          authId: auth_id,
          result,
          duration: `${duration.toFixed(2)}s`,
        });
        counters.error++;
        this.metrics.failedPolls++;
      }
      this.metrics.totalPolls++;
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
      // Detach engine from poller after poll (engine stays cached in cachedEngines for next poll)
      if (user?.auth_id) {
        const poller = this.pollers.get(user.auth_id);
        if (poller) {
          poller.automationEngine = null;
        }
      }
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
    this.pollSemaphore = new Semaphore(this.maxConcurrentPolls);
    this.globalActionQueue = new GlobalActionQueue(this);

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
        .catch((logError) => {
          // Fallback if logger itself fails
          logger.error('Critical: Failed to log interval error', logError);
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
        .catch((logError) => {
          // Fallback if logger itself fails
          logger.error('Critical: Failed to log interval error', logError);
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

    this.pollSemaphore = null;
    this._pollCycleInProgress = false;
    const pollerCount = this.pollers.size;
    this.pollers.clear();

    // Shutdown and discard all cached engines
    for (const [authId, engine] of this.cachedEngines) {
      try {
        engine.shutdown();
      } catch (_) {
        // Best-effort
      }
    }
    this.cachedEngines.clear();

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
   * Remove the cached engine and mutex for a user when their poller is removed.
   * @param {string} authId - User authentication ID
   * @private
   */
  _cleanupEngineAndMutexForAuth(authId) {
    const engine = this.cachedEngines.get(authId);
    if (engine) {
      try {
        engine.shutdown();
      } catch (_) {
        // Best-effort
      }
      this.cachedEngines.delete(authId);
    }
    this.flagUpdateMutexes.delete(authId);
    this.userConsecutiveTimeoutCount.delete(authId);
  }

  /**
   * Teardown only the cached engine for a user (e.g. after runActionBatch).
   * Does not touch poller, mutex, or userConsecutiveTimeoutCount.
   * @param {string} authId - User authentication ID
   * @private
   */
  _teardownEngineForAuth(authId) {
    const engine = this.cachedEngines.get(authId);
    if (engine) {
      try {
        engine.shutdown();
      } catch (_) {
        // Best-effort
      }
      this.cachedEngines.delete(authId);
    }
  }

  /**
   * Teardown poller and engine after a poll cycle. Call from processUserPoll finally and fetch-phase errors.
   * Does not clear userConsecutiveTimeoutCount (preserves timeout backoff).
   * @param {string} authId - User authentication ID
   * @private
   */
  _teardownUserAfterPoll(authId) {
    if (!authId) return;
    this.pollers.delete(authId);
    this._teardownEngineForAuth(authId);
    this.flagUpdateMutexes.delete(authId);
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
        this._cleanupEngineAndMutexForAuth(authId);
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
   * Run a single action batch (from the global queue). Creates an engine, executes actions via API, records execution.
   * @param {Object} descriptor - { authId, rule, torrentsToProcess }
   * @returns {Promise<void>}
   */
  async runActionBatch(descriptor) {
    const { authId, rule, torrentsToProcess } = descriptor;
    if (!authId || !rule || !Array.isArray(torrentsToProcess) || torrentsToProcess.length === 0) {
      return;
    }

    const userInfo = this.masterDb.getUserRegistryInfo(authId);
    if (!userInfo?.encrypted_key) {
      logger.warn('runActionBatch: no encrypted_key for user', { authId });
      return;
    }

    try {
      const engine = await this.createEngineForPoll(authId, userInfo.encrypted_key);
      const { successCount, errorCount } = await engine.ruleExecutor.executeActions(
        rule,
        torrentsToProcess
      );
      if (successCount > 0) {
        await engine.ruleRepository.recordExecution(
          rule.id,
          rule.name,
          successCount,
          errorCount === 0,
          errorCount > 0 ? `${errorCount} actions failed` : null
        );
      }
    } catch (error) {
      logger.error('runActionBatch failed', error, {
        authId,
        ruleId: rule.id,
        ruleName: rule.name,
        torrentCount: torrentsToProcess.length,
        errorMessage: error.message,
      });
    } finally {
      this._teardownEngineForAuth(authId);
    }
  }

  /**
   * Stage 1: Fetch torrents for a single user (TorBox API only). Semaphore limits concurrent fetches.
   * @param {Object} user - User from master DB
   * @param {Semaphore} semaphore - Concurrency cap for fetches
   * @returns {Promise<{user, poller, torrents?}|{user, poller, error}>}
   */
  async fetchTorrentsForUser(user, semaphore) {
    if (!user?.auth_id) {
      return { user, poller: null, error: new Error('Invalid user') };
    }

    await semaphore.acquire();
    const { auth_id, encrypted_key } = user;

    try {
      if (!encrypted_key) {
        return { user, poller: null, error: new Error('User has no API key') };
      }

      const reserveUntil = new Date(Date.now() + MIN_POLL_INTERVAL_MS);
      this.masterDb.updateNextPollAt(auth_id, reserveUntil, 0);

      const poller = await this.getOrCreatePoller(auth_id, encrypted_key);

      const fetchTimeoutMs = Math.min(this.pollKickoutMs, 90000);
      const torrents = await withTimeout(
        poller.fetchTorrents(),
        fetchTimeoutMs,
        `Fetch timeout after ${fetchTimeoutMs / 1000}s`
      );

      return { user, poller, torrents };
    } catch (error) {
      const poller = this.pollers.get(auth_id) || null;
      return { user, poller, error };
    } finally {
      semaphore.release();
    }
  }

  /**
   * Stage 2: Process fetched torrents for one user (state diff, rule eval; no API calls).
   * @param {Object} user - User from master DB
   * @param {UserPoller} poller - Poller instance
   * @param {Array} torrents - Fetched torrent list
   * @param {Object} counters - Success/skipped/error counters
   */
  async processUserPoll(user, poller, torrents, counters) {
    const { auth_id, has_active_rules: dbHasActiveRules } = user;
    let engineForPoll = null;

    try {
      engineForPoll = await this.createEngineForPoll(auth_id, user.encrypted_key);
      poller.automationEngine = engineForPoll;

      const hasActiveRules = await engineForPoll.hasActiveRules();

      if (dbHasActiveRules !== (hasActiveRules ? 1 : 0)) {
        logger.warn('Active rules flag mismatch detected, will sync after poll', {
          authId: auth_id,
          dbFlag: dbHasActiveRules,
          actualState: hasActiveRules,
        });
      }

      if (!hasActiveRules) {
        this.handleSkippedPoll(auth_id, { reason: 'No active automation rules' }, 0);
        counters.skipped++;
        this.metrics.skippedPolls++;
        await this.updateActiveRulesFlag(auth_id, false, dbHasActiveRules);
        return;
      }

      const processStartTime = Date.now();
      const result = await withTimeout(
        poller.processFetchedTorrents(torrents, {
          hasActiveRules,
          calculateStaggerOffset: (pollAuthId, baseIntervalMinutes) =>
            this.calculateStaggerOffset(pollAuthId, baseIntervalMinutes),
        }),
        this.pollKickoutMs,
        `Per-user process timeout after ${this.pollKickoutMs / 1000}s`
      );

      const duration = (Date.now() - processStartTime) / 1000;
      await this.updateActiveRulesFlag(auth_id, hasActiveRules, dbHasActiveRules);
      await this.handleSuccessfulPoll(auth_id, poller, result, hasActiveRules, duration);
      if (result.ruleResults?.pendingActions?.length) {
        this.globalActionQueue?.enqueue(result.ruleResults.pendingActions);
      }
      poller.consecutiveAuthFailures = 0;
      poller.lastPollAt = new Date();
      poller.lastPolledAt = new Date();
      counters.success++;
      this.metrics.successfulPolls++;
      this.metrics.lastPollAt = new Date();
    } catch (error) {
      const duration = 0;
      if (error.isTimeout || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        logger.error('Per-user process timeout in Stage 2', error, { authId: auth_id });
        this.handlePollTimeout(auth_id, this.pollKickoutMs / 1000);
        counters.error++;
      } else {
        logger.error('Error in processUserPoll', error, {
          authId: auth_id,
          errorMessage: error.message,
        });
        this.handlePollError(auth_id, error, duration);
        counters.error++;
      }
    } finally {
      if (auth_id) {
        const p = this.pollers.get(auth_id);
        if (p) p.automationEngine = null;
        if (poller?.userDatabaseManager) {
          poller.userDatabaseManager.closeConnection(auth_id);
        }
        if (poller) poller.dbManager = null;
        this._teardownUserAfterPoll(auth_id);
      }
    }
  }

  /**
   * Poll users that are due for polling (cron-like). Two-phase: fetch all, then process all.
   */
  async pollDueUsers() {
    if (!this.isRunning) {
      logger.debug('Polling scheduler not running, skipping poll check');
      return;
    }

    if (this._pollCycleInProgress) {
      logger.debug('Skipping pollDueUsers - previous cycle still in progress');
      return;
    }

    this._pollCycleInProgress = true;

    const checkStartTime = Date.now();
    logger.debug('Checking for users due for polling', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    try {
      const dueUsers = this.masterDb.getUsersDueForPolling();

      if (dueUsers.length === 0) {
        logger.debug('No users due for polling at this time', {
          checkDuration: `${((Date.now() - checkStartTime) / 1000).toFixed(2)}s`,
        });
        return;
      }

      logger.info('Polling users (two-phase: fetch then process)', {
        dueCount: dueUsers.length,
        maxConcurrentFetch: this.maxConcurrentPolls,
        perUserTimeoutSeconds: this.pollKickoutMs / 1000,
      });

      if (dueUsers.length >= 20) {
        logger.warn('PollDueUsers: large due list', { dueCount: dueUsers.length });
      }

      logger.debug('Found users due for polling', {
        count: dueUsers.length,
        authIds: dueUsers.map((u) => u?.auth_id).filter(Boolean),
      });

      const counters = { success: 0, skipped: 0, error: 0 };
      const semaphore = this.pollSemaphore;
      if (!semaphore) {
        return;
      }

      // Stage 1: Fetch torrents for all due users (semaphore caps concurrent API fetches)
      const fetchResults = await Promise.allSettled(
        dueUsers.map((u) => this.fetchTorrentsForUser(u, semaphore))
      );

      const fetchedList = [];
      for (let i = 0; i < fetchResults.length; i++) {
        const r = fetchResults[i];
        const user = dueUsers[i];
        if (r.status === 'rejected') {
          counters.error++;
          this.handlePollError(user?.auth_id, r.reason, 0);
          if (user?.auth_id) this._teardownUserAfterPoll(user.auth_id);
          continue;
        }
        const value = r.value;
        if (value.error) {
          counters.error++;
          if (value.error.isConnectionError) {
            this.handleConnectionError(value.user.auth_id, 0);
          } else if (value.error.isAuthError || value.error.name === 'AuthenticationError') {
            if (value.poller) value.poller.consecutiveAuthFailures = (value.poller.consecutiveAuthFailures || 0) + 1;
            this.handlePollError(value.user.auth_id, value.error, 0);
          } else {
            this.handlePollError(value.user.auth_id, value.error, 0);
          }
          if (value.user?.auth_id) this._teardownUserAfterPoll(value.user.auth_id);
          continue;
        }
        if (value.torrents) {
          fetchedList.push({ user: value.user, poller: value.poller, torrents: value.torrents });
        }
      }

      // Stage 2: Process all fetched results (state diff + rule eval; no API calls)
      await Promise.allSettled(
        fetchedList.map(({ user, poller, torrents }) =>
          this.processUserPoll(user, poller, torrents, counters)
        )
      );

      this.metrics.totalPolls += dueUsers.length;
      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.info('Poll cycle completed', {
        totalUsers: dueUsers.length,
        processedCount: fetchedList.length,
        successCount: counters.success,
        skippedCount: counters.skipped,
        errorCount: counters.error,
        totalDuration: `${totalDuration}s`,
      });
    } catch (error) {
      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.error('Error in pollDueUsers', error, {
        duration: `${totalDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
    } finally {
      this._pollCycleInProgress = false;
    }
  }

  /**
   * Refresh pollers based on active users.
   * - Light refresh (most runs): use master DB has_active_rules only; add/remove pollers. No user DB opens.
   * - Full refresh (every REFRESH_FULL_SYNC_EVERY_N): sync has_active_rules from all user DBs, then add/remove pollers.
   * Pollers are created on demand when users are due; refresh only removes pollers for users without active rules.
   */
  async refreshPollers() {
    if (this._refreshInProgress) {
      logger.debug('Skipping refreshPollers - previous run still in progress');
      return;
    }
    this._refreshInProgress = true;
    this._refreshCount++;
    const refreshStartTime = Date.now();
    const doFullSync = this._refreshCount % REFRESH_FULL_SYNC_EVERY_N === 1; // 1st, 7th, 13th... (and first run after start)

    try {
      const poolStats = this.userDatabaseManager.getPoolStats?.() ?? null;
      if (doFullSync) {
        logger.warn('RefreshPollers full sync started (visible in prod)', {
          refreshCount: this._refreshCount,
          currentPollers: this.pollers.size,
          poolSize: poolStats?.size ?? null,
          poolMaxSize: poolStats?.maxSize ?? null,
        });
      } else {
        logger.debug('RefreshPollers light refresh started', {
          refreshCount: this._refreshCount,
          currentPollers: this.pollers.size,
        });
      }

      let usersWithActiveRules;

      if (doFullSync) {
        // Step 1 (full sync only): Sync has_active_rules from each user DB, then get list with active rules
        const activeUsers = this.userDatabaseManager.getActiveUsers();
        const currentAuthIds = new Set(this.pollers.keys());
        const syncStats = { synced: 0, errors: 0, skipped: 0 };
        const syncSemaphore = new Semaphore(this._refreshSyncConcurrency);

        const syncOneUser = async (user) => {
          const { auth_id, encrypted_key, has_active_rules: dbFlag } = user;
          if (!encrypted_key) return;

          // If master DB already reports active rules, trust it — all write paths keep the flag
          // in sync. Only open the user DB when the flag is 0 to verify it's not a false negative.
          if (dbFlag === 1) {
            return;
          }

          await syncSemaphore.acquire();
          try {
            let actualHasActiveRules = false;
            const userDb = await this.userDatabaseManager.getUserDatabase(auth_id);
            if (userDb && userDb.db) {
              try {
                const result = userDb.db
                  .prepare('SELECT COUNT(*) as count FROM automation_rules WHERE enabled = 1')
                  .get();
                actualHasActiveRules = result && result.count > 0;
              } finally {
                this.userDatabaseManager.closeConnection(auth_id);
              }
            } else {
              syncStats.skipped++;
              return;
            }
            const actualFlag = actualHasActiveRules ? 1 : 0;
            if (dbFlag !== actualFlag) {
              this.masterDb.updateActiveRulesFlag(auth_id, actualHasActiveRules);
              syncStats.synced++;
            }
          } catch (error) {
            logger.warn('Failed to sync active rules flag for user', {
              authId: user.auth_id,
              errorMessage: error.message,
            });
            syncStats.errors++;
          } finally {
            syncSemaphore.release();
          }
        };

        await Promise.all(activeUsers.map((user) => syncOneUser(user)));

        const syncDurationMs = Date.now() - refreshStartTime;
        logger.warn('RefreshPollers full sync completed (visible in prod)', {
          activeUsersCount: activeUsers.length,
          synced: syncStats.synced,
          errors: syncStats.errors,
          skipped: syncStats.skipped,
          durationMs: syncDurationMs,
        });

        cache.invalidateActiveUsers();
        const refreshedActiveUsers = this.userDatabaseManager.getActiveUsers();
        usersWithActiveRules = refreshedActiveUsers.filter((user) => user.has_active_rules === 1);
      } else {
        // Light refresh: use master DB only (has_active_rules is kept in sync by API when rules are toggled)
        const activeUsers = this.userDatabaseManager.getActiveUsers();
        usersWithActiveRules = activeUsers.filter((user) => user.has_active_rules === 1);
      }

      const currentAuthIds = new Set(this.pollers.keys());

      logger.debug('Active users with rules', {
        usersWithActiveRulesCount: usersWithActiveRules.length,
      });

      const stats = { removed: 0 };

      // Build a Set for O(1) lookup in the removal pass below
      const activeRulesAuthIdSet = new Set(usersWithActiveRules.map((u) => u.auth_id));

      // Remove pollers for users without active rules (pollers are created on demand when user is due)
      for (const authId of currentAuthIds) {
        if (!activeRulesAuthIdSet.has(authId)) {
          this.pollers.delete(authId);
          this._cleanupEngineAndMutexForAuth(authId);
          logger.info('Removed poller for user without active rules', {
            authId,
          });
          stats.removed++;
        }
      }

      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      if (doFullSync) {
        logger.warn('RefreshPollers full sync completed', {
          removedCount: stats.removed,
          totalPollers: this.pollers.size,
          duration: `${refreshDuration}s`,
        });
      } else {
        logger.debug('RefreshPollers light completed', {
          removedCount: stats.removed,
          totalPollers: this.pollers.size,
          duration: `${refreshDuration}s`,
        });
      }
    } catch (error) {
      const refreshDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(2);
      logger.error('Error refreshing pollers', error, {
        duration: `${refreshDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
    } finally {
      this._refreshInProgress = false;
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
      metrics: {
        ...this.metrics,
        successRate:
          this.metrics.totalPolls > 0
            ? ((this.metrics.successfulPolls / this.metrics.totalPolls) * 100).toFixed(2) + '%'
            : '0%',
      },
      configuration: {
        pollCheckInterval: this.pollCheckInterval,
        refreshInterval: this.refreshInterval,
        minPollIntervalMs: MIN_POLL_INTERVAL_MS,
        pollKickoutMs: this.pollKickoutMs,
        maxConcurrentPolls: this.maxConcurrentPolls,
        pollerCleanupIntervalHours: this.pollerCleanupIntervalHours,
      },
    };
  }

  /**
   * Manually trigger a poll for a specific user.
   * Creates poller and engine on demand; tears them down after the poll.
   * @param {string} authId - User authentication ID
   * @returns {Promise<Object>} Poll result
   */
  async triggerPoll(authId) {
    if (!authId) {
      throw new Error('authId is required for triggerPoll');
    }

    logger.info('Manually triggering poll for user', {
      authId,
      timestamp: new Date().toISOString(),
    });

    const userInfo = this.masterDb.getUserRegistryInfo(authId);
    if (!userInfo?.encrypted_key) {
      throw new Error(`No user or API key found for ${authId}`);
    }

    const poller = await this.getOrCreatePoller(authId, userInfo.encrypted_key);

    try {
      const engineForPoll = await this.createEngineForPoll(authId, userInfo.encrypted_key);
      poller.automationEngine = engineForPoll;

      const result = await withTimeout(
        poller.poll(null, {
          calculateStaggerOffset: (pollAuthId, baseIntervalMinutes) =>
            this.calculateStaggerOffset(pollAuthId, baseIntervalMinutes),
          updateMasterDb: true,
        }),
        this.pollKickoutMs,
        `Per-user poll timeout after ${this.pollKickoutMs / 1000}s`
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
          timeoutMs: this.pollKickoutMs,
        });
      } else {
        logger.error('Manual poll failed', error, {
          authId,
          errorMessage: error.message,
        });
      }
      throw error;
    } finally {
      poller.automationEngine = null;
      if (poller.userDatabaseManager) {
        poller.userDatabaseManager.closeConnection(authId);
      }
      poller.dbManager = null;
      this._teardownUserAfterPoll(authId);
    }
  }
}

export default PollingScheduler;
