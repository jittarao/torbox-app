import UserPoller from './UserPoller.js';
import AutomationEngine from './AutomationEngine.js';
import ApiClient from '../api/ApiClient.js';
import GlobalActionQueue from './GlobalActionQueue.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import Semaphore from '../utils/semaphore.js';
import Mutex from '../utils/mutex.js';

// Constants
const DEFAULT_POLL_CHECK_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// Minimum time between polling the same user (each user must not be polled more than once per this window)
const MIN_POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes — minimum time between polling the same user
// Per-user kick-out: max time one user's poll may run inside a cycle before we give up and free the slot
const DEFAULT_POLL_KICKOUT_MS = 180000; // 3 minutes — allows slow API/DB for users with many torrents; set POLL_KICKOUT_MS=120000 for stricter slot usage
const DEFAULT_MAX_CONCURRENT_POLLS = 12; // Number of users polled in parallel
const DEFAULT_MAX_CONCURRENT_PROCESS = 8; // Stage 2: max users processed in parallel (state diff + rule eval)
const DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS = 24;
const ERROR_RETRY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes after error or first timeout
const TIMEOUT_BACKOFF_RETRY_MS = 60 * 60 * 1000; // 60 minutes after repeated timeouts (free concurrency slot)
const SKIPPED_POLL_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours when user has no active rules
const CLEANUP_CYCLE_MULTIPLIER = 10; // Run cleanup every 10 poll cycles
const PENDING_ACTIONS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — delete pending_actions older than this
const PENDING_ACTIONS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run pending_actions TTL cleanup hourly
const STAGGER_PERCENTAGE = 0.3; // 30% of base interval (~9 min for 30-min window)

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

  // Prevent unhandled rejections if promise rejects after timeout (race already settled)
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
    // When timeout has not occurred, rejection is already propagated via wrappedPromise; do not log.
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
    this.pendingCleanupIntervalId = null;

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
    this.maxConcurrentProcess = Math.max(
      1,
      options.maxConcurrentProcess ??
        parseInt(process.env.MAX_CONCURRENT_PROCESS || String(DEFAULT_MAX_CONCURRENT_PROCESS), 10)
    );
    this.pollerCleanupIntervalHours = Math.max(
      1,
      options.pollerCleanupIntervalHours || DEFAULT_POLLER_CLEANUP_INTERVAL_HOURS
    );
    this.eventNotifier = options.eventNotifier || null;

    // State
    this.lastCleanupAt = null;
    this.flagUpdateMutexes = new Map();
    /** Per-user mutex for GlobalActionQueue so same-user batches run sequentially and avoid engine race */
    this.actionBatchMutexes = new Map();
    /** Per-user mutex so only one pipeline run (scheduler Stage 2 or triggerPoll) runs per user at a time */
    this.pipelineMutexes = new Map();
    /** Shared ApiClient per user (single decrypt per user); cleared when poller is removed */
    this.cachedApiClients = new Map();
    /** Cached AutomationEngine per user — avoids re-running initialize() (4-5 DB queries) on every poll */
    this.cachedEngines = new Map();
    /** @type {Map<string, number>} Consecutive timeout count per user; used for backoff so repeat timeouts don't hold slots */
    this.userConsecutiveTimeoutCount = new Map();
    /** Single semaphore shared across all poll cycles so we never exceed maxConcurrentPolls globally */
    this.pollSemaphore = null;
    /** Stage 2 semaphore: caps concurrent processUserPoll (state diff + rule eval) to avoid SQLite contention */
    this.processSemaphore = null;
    this._refreshInProgress = false;
    this._refreshCount = 0;

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
   * Get or create mutex for action batch execution (same-user batches serialized).
   * @param {string} authId - User authentication ID
   * @returns {Mutex} Mutex instance
   */
  getActionBatchMutex(authId) {
    let mutex = this.actionBatchMutexes.get(authId);
    if (!mutex) {
      mutex = new Mutex();
      this.actionBatchMutexes.set(authId, mutex);
    }
    return mutex;
  }

  /**
   * Get or create mutex for pipeline execution (scheduler Stage 2 and triggerPoll).
   * Ensures only one poll pipeline runs per user at a time.
   * @param {string} authId - User authentication ID
   * @returns {Mutex} Mutex instance
   */
  getPipelineMutex(authId) {
    let mutex = this.pipelineMutexes.get(authId);
    if (!mutex) {
      mutex = new Mutex();
      this.pipelineMutexes.set(authId, mutex);
    }
    return mutex;
  }

  /**
   * Run an async operation under the per-user pipeline mutex (e.g. manual rule run).
   * Use so manual execution does not race with scheduled poll on shadow state.
   * @param {string} authId - User authentication ID
   * @param {Function} operation - Async function to run
   * @returns {Promise<*>} Result of operation()
   */
  async runWithPipelineLock(authId, operation) {
    const mutex = this.getPipelineMutex(authId);
    await mutex.acquire();
    try {
      return await operation();
    } finally {
      mutex.release();
      if (mutex.isEmpty()) {
        this.pipelineMutexes.delete(authId);
      }
    }
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
   * Get or create a shared ApiClient for a user (single decrypt per user).
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {ApiClient} ApiClient instance
   */
  getOrCreateApiClient(authId, encryptedKey) {
    let client = this.cachedApiClients.get(authId);
    if (client) return client;
    const apiKey = decrypt(encryptedKey);
    client = new ApiClient(apiKey);
    this.cachedApiClients.set(authId, client);
    return client;
  }

  /**
   * Get or create an automation engine for a poll cycle.
   * Engines are cached per-user so that initialize() (4-5 DB queries) only runs once instead
   * of on every poll. The rule evaluator (and its DB connection) is created lazily when
   * evaluateRules runs, not at the start of processUserPoll. The cached engine is discarded when the poller is removed.
   * @param {string} authId - User authentication ID
   * @param {string} encryptedKey - Encrypted API key
   * @returns {Promise<AutomationEngine>} Automation engine instance
   */
  async createEngineForPoll(authId, encryptedKey) {
    const cached = this.cachedEngines.get(authId);
    if (cached?.isInitialized) {
      return cached;
    }

    const apiClient = this.getOrCreateApiClient(authId, encryptedKey);
    const engine = new AutomationEngine(
      authId,
      encryptedKey,
      this.userDatabaseManager,
      this.masterDb,
      apiClient
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
      const apiClient = this.getOrCreateApiClient(authId, encryptedKey);
      const poller = new UserPoller(
        authId,
        encryptedKey,
        null, // connection acquired at poll time and released after each poll
        null, // engine is attached from cachedEngines just before each poll and detached after
        this.masterDb,
        this.userDatabaseManager,
        apiClient
      );

      poller.lastPollAt = new Date();
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
    } else if (poller.lastPollAt === null) {
      poller.lastPollAt = new Date();
    }

    return poller;
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
    this.processSemaphore = new Semaphore(this.maxConcurrentProcess);
    this.globalActionQueue = new GlobalActionQueue(this);

    // Resume any pending actions persisted before a crash/restart
    this.globalActionQueue.loadFromPersistence().catch((err) => {
      logger.error('loadFromPersistence failed', err, { errorMessage: err.message });
    });

    // Initial load of active users
    logger.info('Performing initial poller refresh');
    await this.refreshPollers();
    await this.spreadOverdueUsersOnStartup();

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

    this.pendingCleanupIntervalId = setInterval(() => {
      this.cleanupStalePendingActions();
    }, PENDING_ACTIONS_CLEANUP_INTERVAL_MS);

    logger.info('Polling scheduler started successfully', {
      pollCheckInterval: `${this.pollCheckInterval / 1000}s`,
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    // refreshPollers is called from routes on rule save/toggle/delete (event-driven), not on a timer
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
    if (this.pendingCleanupIntervalId) {
      clearInterval(this.pendingCleanupIntervalId);
      this.pendingCleanupIntervalId = null;
    }

    this.pollSemaphore = null;
    this.processSemaphore = null;
    const pollerCount = this.pollers.size;
    this.pollers.clear();

    // Shutdown and discard all cached engines and API clients
    for (const [, engine] of this.cachedEngines) {
      try {
        engine.shutdown();
      } catch (_) {
        // Best-effort
      }
    }
    this.cachedEngines.clear();
    this.cachedApiClients.clear();

    logger.info('PollingScheduler stopped', {
      clearedPollers: pollerCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate stagger offset for a user based on authId hash
   * Spreads users across STAGGER_PERCENTAGE of base interval to prevent simultaneous polling
   * @param {string} authId - User authentication ID
   * @param {number} baseIntervalMinutes - Base polling interval in minutes
   * @returns {number} - Stagger offset in milliseconds
   */
  calculateStaggerOffset(authId, baseIntervalMinutes) {
    let hash = 0;
    for (let i = 0; i < authId.length; i++) {
      const char = authId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }

    const normalizedHash = Math.abs(hash % 100) / 100;
    const baseIntervalMs = baseIntervalMinutes * 60 * 1000;
    return normalizedHash * baseIntervalMs * STAGGER_PERCENTAGE;
  }

  /**
   * Spread overdue users across the next MIN_POLL_INTERVAL_MS window on startup
   * to avoid thundering herd (all users polled in the first tick).
   */
  async spreadOverdueUsersOnStartup() {
    const dueUsers = this.masterDb.getUsersDueForPolling();
    if (dueUsers.length === 0) return;

    const now = Date.now();
    for (const user of dueUsers) {
      if (!user?.auth_id) continue;
      let hash = 0;
      for (let i = 0; i < user.auth_id.length; i++) {
        const char = user.auth_id.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      const offset = (Math.abs(hash % 100) / 100) * MIN_POLL_INTERVAL_MS;
      const nextPollAt = new Date(now + offset);
      this.masterDb.updateNextPollAt(user.auth_id, nextPollAt, user.non_terminal_torrent_count ?? 0);
    }
    logger.info('Spread overdue users across poll window on startup', {
      spreadCount: dueUsers.length,
      windowMinutes: MIN_POLL_INTERVAL_MS / (60 * 1000),
    });
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
    this.cachedApiClients.delete(authId);
    this.flagUpdateMutexes.delete(authId);
    this.actionBatchMutexes.delete(authId);
    this.pipelineMutexes.delete(authId);
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
   * Clean up pollers that haven't been polled recently
   * @returns {number} Number of pollers cleaned up
   */
  cleanupStalePollers() {
    const now = Date.now();
    const cleanupThresholdMs = this.pollerCleanupIntervalHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    for (const [authId, poller] of this.pollers.entries()) {
      const lastPollAt = poller.lastPollAt;
      if (!lastPollAt) {
        continue;
      }

      const timeSinceLastPoll = now - new Date(lastPollAt).getTime();
      if (timeSinceLastPoll > cleanupThresholdMs) {
        logger.info('Removing stale poller (not polled recently)', {
          authId,
          lastPollAt: lastPollAt.toISOString(),
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
   * Delete pending_actions rows older than PENDING_ACTIONS_TTL_MS to avoid unbounded growth.
   * Called hourly by the scheduler.
   * @returns {number} Number of rows deleted
   */
  cleanupStalePendingActions() {
    if (!this.masterDb?.deletePendingActionsOlderThan) return 0;
    try {
      const cutoff = new Date(Date.now() - PENDING_ACTIONS_TTL_MS);
      const deleted = this.masterDb.deletePendingActionsOlderThan(cutoff);
      if (deleted > 0) {
        logger.info('Cleaned up stale pending_actions', { deleted, cutoff: cutoff.toISOString() });
      }
      return deleted;
    } catch (err) {
      logger.error('Failed to cleanup stale pending_actions', err, { errorMessage: err.message });
      return 0;
    }
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

    const mutex = this.getActionBatchMutex(authId);
    await mutex.acquire();
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
        cache.invalidateRecentRuleExecutions(authId);
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
      mutex.release();
      if (mutex.isEmpty()) {
        this.actionBatchMutexes.delete(authId);
      }
    }
  }

  /**
   * Fetch torrents for a single user (TorBox API only).
   * @param {Object} user - User from master DB
   * @param {Semaphore|null} semaphore - Optional concurrency cap; if provided, acquire/release around fetch. If null, caller holds the slot (e.g. unified fetch+process worker).
   * @returns {Promise<{user, poller, torrents?}|{user, poller, error}>}
   */
  async fetchTorrentsForUser(user, semaphore) {
    if (!user?.auth_id) {
      return { user, poller: null, error: new Error('Invalid user') };
    }

    if (semaphore) await semaphore.acquire();
    const { auth_id, encrypted_key } = user;

    try {
      if (!encrypted_key) {
        return { user, poller: null, error: new Error('User has no API key') };
      }

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
      if (semaphore) semaphore.release();
    }
  }

  /**
   * Stage 2: Process fetched torrents for one user (state diff, rule eval; no API calls).
   * @param {Object} user - User from master DB
   * @param {UserPoller} poller - Poller instance
   * @param {Array} torrents - Fetched torrent list
   * @param {Object} counters - Success/skipped/error counters
   * @param {Object} [options] - callerHoldsPipelineMutex: true when caller acquired mutex before semaphore (scheduled path)
   */
  async processUserPoll(user, poller, torrents, counters, options = {}) {
    const { auth_id } = user;
    const callerHoldsPipelineMutex = options.callerHoldsPipelineMutex === true;
    let engineForPoll = null;
    const processStartTime = Date.now();
    const pipelineMutex = this.getPipelineMutex(auth_id);
    if (!callerHoldsPipelineMutex) {
      await pipelineMutex.acquire();
    }

    try {
      engineForPoll = await this.createEngineForPoll(auth_id, user.encrypted_key);
      poller.automationEngine = engineForPoll;

      const hasActiveRules = await engineForPoll.hasActiveRules();

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
      await this.handleSuccessfulPoll(auth_id, poller, result, hasActiveRules, duration);
      if (result.ruleResults?.pendingActions?.length) {
        this.globalActionQueue?.enqueue(result.ruleResults.pendingActions);
      }
      if (this.masterDb && this.masterDb.resetConsecutiveAuthFailures) {
        this.masterDb.resetConsecutiveAuthFailures(auth_id);
      }
      if (this.eventNotifier && result.changes && (result.changes.new?.length || result.changes.updated?.length || result.changes.removed?.length)) {
        setImmediate(() => this.eventNotifier.notify(auth_id));
      }
      poller.lastPollAt = new Date();
      counters.success++;
      this.metrics.successfulPolls++;
      this.metrics.lastPollAt = new Date();
    } catch (error) {
      const duration = (Date.now() - processStartTime) / 1000;
      if (error.isTimeout || error.name === 'TimeoutError' || error.message?.includes('timeout')) {
        logger.error('Per-user process timeout in Stage 2', error, { authId: auth_id });
        this.handlePollTimeout(auth_id, duration);
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
      if (!callerHoldsPipelineMutex) {
        pipelineMutex.release();
        if (pipelineMutex.isEmpty()) {
          this.pipelineMutexes.delete(auth_id);
        }
      }
      if (auth_id) {
        const p = this.pollers.get(auth_id);
        if (p) p.automationEngine = null;
        if (poller?.userDatabaseManager) {
          poller.userDatabaseManager.closeConnection(auth_id);
        }
        if (poller) poller.dbManager = null;
        // Per-poll teardown: poller and engine are intentionally kept for reuse on next poll
      }
    }
  }

  /**
   * Poll users that are due for polling (cron-like). Two-phase: fetch all, then process all.
   * No global cycle lock — reserve next_poll_at for all due users up front so the next tick
   * does not double-schedule the same users; semaphores cap concurrency.
   */
  async pollDueUsers() {
    if (!this.isRunning) {
      logger.debug('Polling scheduler not running, skipping poll check');
      return;
    }

    if (this.shouldRunCleanup()) {
      this.cleanupStalePollers();
    }

    const checkStartTime = Date.now();
    logger.debug('Checking for users due for polling', {
      activePollers: this.pollers.size,
      timestamp: new Date().toISOString(),
    });

    try {
      const dueUsers = this.masterDb.getUsersDueForPolling();

      // Only fetch for users with active rules; skip API call for others and reschedule
      const usersToFetch = dueUsers.filter((u) => u.has_active_rules === 1);
      const usersToSkip = dueUsers.filter((u) => u.has_active_rules !== 1);
      for (const user of usersToSkip) {
        if (user?.auth_id) {
          this.handleSkippedPoll(user.auth_id, { reason: 'No active automation rules' }, 0);
        }
      }

      if (usersToFetch.length === 0) {
        logger.debug('No users due for polling at this time', {
          checkDuration: `${((Date.now() - checkStartTime) / 1000).toFixed(2)}s`,
          skippedNoRules: usersToSkip.length,
        });
        return;
      }

      // Reserve next_poll_at for all users we are about to fetch so the next tick does not re-enqueue them
      const reserveUntil = new Date(Date.now() + MIN_POLL_INTERVAL_MS);
      const authIdsToReserve = usersToFetch.map((u) => u?.auth_id).filter(Boolean);
      if (authIdsToReserve.length > 0) {
        this.masterDb.updateNextPollAtBatch(authIdsToReserve, reserveUntil);
      }

      logger.info('Polling users (unified fetch-then-process per user)', {
        dueCount: usersToFetch.length,
        maxConcurrentPolls: this.maxConcurrentPolls,
        perUserTimeoutSeconds: this.pollKickoutMs / 1000,
      });

      if (usersToFetch.length >= 20) {
        logger.warn('PollDueUsers: large due list', { dueCount: usersToFetch.length });
      }

      logger.debug('Found users due for polling', {
        count: usersToFetch.length,
        authIds: usersToFetch.map((u) => u?.auth_id).filter(Boolean),
      });

      const counters = { success: 0, skipped: 0, error: 0 };
      const pollSem = this.pollSemaphore;
      const processSem = this.processSemaphore;
      if (!pollSem) {
        return;
      }

      const userQueue = [...usersToFetch];
      const worker = async () => {
        while (userQueue.length > 0) {
          const user = userQueue.shift();
          if (!user?.auth_id) continue;

          await pollSem.acquire();
          try {
            const result = await this.fetchTorrentsForUser(user, null);
            if (result.error) {
              counters.error++;
              if (result.error.isConnectionError) {
                this.handleConnectionError(result.user.auth_id, 0);
              } else if (result.error.isAuthError || result.error.name === 'AuthenticationError') {
                this.handlePollError(result.user.auth_id, result.error, 0);
              } else {
                this.handlePollError(result.user.auth_id, result.error, 0);
              }
              continue;
            }
            if (!result.torrents) continue;

            const auth_id = result.user.auth_id;
            if (!processSem) {
              await this.processUserPoll(result.user, result.poller, result.torrents, counters, {
                callerHoldsPipelineMutex: false,
              });
              continue;
            }
            const pipelineMutex = this.getPipelineMutex(auth_id);
            await pipelineMutex.acquire();
            await processSem.acquire();
            try {
              await this.processUserPoll(result.user, result.poller, result.torrents, counters, {
                callerHoldsPipelineMutex: true,
              });
            } finally {
              processSem.release();
              pipelineMutex.release();
              if (pipelineMutex.isEmpty()) {
                this.pipelineMutexes.delete(auth_id);
              }
            }
          } catch (err) {
            counters.error++;
            this.handlePollError(user?.auth_id, err, 0);
          } finally {
            pollSem.release();
          }
        }
      };

      const workerCount = Math.min(this.maxConcurrentPolls, userQueue.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));

      this.metrics.totalPolls += usersToFetch.length;
      const totalDuration = ((Date.now() - checkStartTime) / 1000).toFixed(2);
      logger.info('Poll cycle completed', {
        totalUsers: usersToFetch.length,
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
    }
  }

  /**
   * Refresh pollers based on active users.
   * Uses master DB has_active_rules only (event-driven updates from RuleRepository keep it in sync). No user DB opens.
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

    try {
      logger.debug('RefreshPollers started', {
        refreshCount: this._refreshCount,
        currentPollers: this.pollers.size,
      });

      const activeUsers = this.userDatabaseManager.getActiveUsers();
      const usersWithActiveRules = activeUsers.filter((user) => user.has_active_rules === 1);
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
      logger.debug('RefreshPollers completed', {
        removedCount: stats.removed,
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
        maxConcurrentProcess: this.maxConcurrentProcess,
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
    const pipelineMutex = this.getPipelineMutex(authId);
    await pipelineMutex.acquire();

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
      pipelineMutex.release();
      if (pipelineMutex.isEmpty()) {
        this.pipelineMutexes.delete(authId);
      }
      poller.automationEngine = null;
      if (poller.userDatabaseManager) {
        poller.userDatabaseManager.closeConnection(authId);
      }
      poller.dbManager = null;
      // Per-poll teardown: poller and engine kept for reuse
    }
  }
}

export default PollingScheduler;
