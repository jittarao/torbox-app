import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import PollingIntervalCalculator from './helpers/PollingIntervalCalculator.js';
import DatabaseConnectionManager from './helpers/DatabaseConnectionManager.js';

/**
 * Per-user poller
 * Handles polling and state updates for a single user.
 * DB connection is acquired at poll time and released after each poll (lazy connection)
 * so the pool is not filled by idle pollers when minimum poll interval is 5+ minutes.
 */
class UserPoller {
  constructor(
    authId,
    encryptedApiKey,
    userDb,
    automationEngine = null,
    masterDb = null,
    userDatabaseManager = null,
    sharedApiClient = null
  ) {
    if (!authId) {
      throw new Error('authId is required for UserPoller');
    }
    if (!encryptedApiKey) {
      throw new Error('encryptedApiKey is required for UserPoller');
    }

    this.authId = authId;
    this.encryptedApiKey = encryptedApiKey;
    this.masterDb = masterDb;
    this.automationEngine = automationEngine;
    this.userDatabaseManager = userDatabaseManager;
    this.isPolling = false;
    this._pollGeneration = 0; // So zombie poll finally doesn't clear isPolling after timeout + new poll
    this.lastPollAt = null;
    this.lastPolledAt = null; // Track when poller was last used (for cleanup)
    this.lastPollError = null;
    /** Cancellation token set by the scheduler when the per-user timeout fires so ghost polls exit early */
    this._cancelToken = null;

    if (sharedApiClient) {
      this.apiClient = sharedApiClient;
    } else {
      try {
        this.apiKey = decrypt(encryptedApiKey);
        this.apiClient = new ApiClient(this.apiKey);
      } catch (error) {
        logger.error('Failed to decrypt API key or create API client', error, {
          authId,
          errorMessage: error.message,
        });
        throw new Error(`Failed to initialize UserPoller: ${error.message}`);
      }
    }

    // DB connection is acquired at poll time and released after each poll (userDb may be null)
    if (userDb && userDatabaseManager) {
      this.dbManager = new DatabaseConnectionManager(authId, userDb, userDatabaseManager);
    } else {
      this.dbManager = null;
    }
  }

  /**
   * Check if polling should be performed (user has active rules)
   */
  async shouldPoll() {
    if (!this.automationEngine) {
      return false;
    }
    return await this.automationEngine.hasActiveRules();
  }

  /**
   * Count non-terminal torrents. O(1) when changes from processStateChanges is provided.
   * @param {Array} torrents - Array of torrent objects
   * @param {Object} [changes] - Optional result from processStateChanges; when present, non-terminal = torrents.length - changes.removed.length
   * @returns {number} - Count of non-terminal torrents
   */
  countNonTerminalTorrents(torrents, changes = null) {
    if (!Array.isArray(torrents)) {
      logger.warn('countNonTerminalTorrents called with non-array', {
        authId: this.authId,
        torrentsType: typeof torrents,
      });
      return 0;
    }
    if (changes && Array.isArray(changes.removed)) {
      return Math.max(0, torrents.length - changes.removed.length);
    }
    if (!this.dbManager) return 0;

    try {
      const stateDiffEngine = this.dbManager.getStateDiffEngine();
      let count = 0;
      for (const torrent of torrents) {
        if (!torrent) {
          continue;
        }
        const state = stateDiffEngine.getTorrentState(torrent);
        if (!stateDiffEngine.isTerminalState(state)) {
          count++;
        }
      }
      return count;
    } catch (error) {
      logger.warn('Error counting non-terminal torrents', error, {
        authId: this.authId,
        torrentCount: torrents.length,
        errorMessage: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if rules have executed recently (current poll or last hour)
   * State transition: Determines if user is in active state
   * @param {Object} ruleResults - Optional rule evaluation results with execution info
   * @returns {Promise<boolean>} - True if rules executed recently
   */
  async checkRecentRuleExecutions(ruleResults = null) {
    // Check if rules executed in the current poll cycle
    if (ruleResults && ruleResults.executed > 0) {
      logger.debug('Rules executed in current poll cycle, user in active mode', {
        authId: this.authId,
        executedCount: ruleResults.executed,
      });
      return true;
    }

    // Check cache to avoid DB query on every poll for idle users (5 min TTL)
    const cached = cache.getRecentRuleExecutions(this.authId);
    if (cached !== undefined) {
      return cached;
    }

    // If no executions in current poll, check database for executions in last hour
    if (this.automationEngine) {
      try {
        const hasRecentExecutions = await this.automationEngine.hasRecentRuleExecutions(1); // Last hour
        cache.setRecentRuleExecutions(this.authId, hasRecentExecutions);
        return hasRecentExecutions;
      } catch (error) {
        logger.error('Failed to check recent rule executions for adaptive polling', error, {
          authId: this.authId,
        });
        // Fall through to false on error (conservative: assume idle mode)
        return false;
      }
    }

    return false;
  }

  /**
   * Safely get minimum rule interval from automation engine
   * State transition: Used in active mode to determine optimal polling frequency
   * @returns {Promise<number|null>} - Minimum rule interval in minutes, or null if unavailable
   */
  async getMinimumRuleIntervalSafe() {
    if (!this.automationEngine) {
      return null;
    }

    try {
      return await this.automationEngine.getMinimumRuleInterval();
    } catch (error) {
      logger.error('Failed to get minimum rule interval', error, {
        authId: this.authId,
      });
      // Return null to fall back to default logic
      return null;
    }
  }

  /**
   * Determine polling mode based on rule execution history
   * State transition: Idle -> Active (when rules execute) or Active -> Idle (after 1 hour of inactivity)
   * @param {boolean} hasActiveRules - Whether user has active rules
   * @param {Object} ruleResults - Optional rule evaluation results
   * @returns {Promise<'idle'|'active'|'no-rules'>} - Current polling mode
   */
  async determinePollingMode(hasActiveRules, ruleResults = null) {
    if (!hasActiveRules) {
      return 'no-rules';
    }

    const hasRecentExecutions = await this.checkRecentRuleExecutions(ruleResults);
    return hasRecentExecutions ? 'active' : 'idle';
  }

  /**
   * Calculate next poll timestamp based on state and adaptive polling logic
   *
   * State Machine:
   * - no-rules: User has no active rules -> poll every 60 minutes
   * - idle: User has active rules but no recent executions -> poll every 60 minutes
   * - active: User has active rules and recent executions -> poll based on rule intervals or fallback logic
   *
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @param {boolean} hasActiveRules - Whether user has active rules
   * @param {Function} calculateStaggerOffset - Function to calculate stagger offset
   * @param {Object} ruleResults - Optional rule evaluation results with execution info
   * @returns {Promise<Date>} - Next poll timestamp
   */
  async calculateNextPollAt(
    nonTerminalCount,
    hasActiveRules,
    calculateStaggerOffset = null,
    ruleResults = null
  ) {
    // Determine current polling mode
    const pollingMode = await this.determinePollingMode(hasActiveRules, ruleResults);

    // Use pre-computed minRuleInterval from ruleResults when available (avoids a redundant DB
    // query since evaluateRules() already loaded all enabled rules and computed this value).
    const minRuleInterval =
      pollingMode === 'active'
        ? ruleResults?.minRuleInterval !== undefined
          ? ruleResults.minRuleInterval
          : await this.getMinimumRuleIntervalSafe()
        : null;

    return PollingIntervalCalculator.calculateNextPollAt(
      this.authId,
      pollingMode,
      nonTerminalCount,
      minRuleInterval,
      ruleResults,
      calculateStaggerOffset
    );
  }

  /**
   * Check if database connection is closed and refresh if needed
   * @returns {Promise<void>}
   */
  async ensureDatabaseConnection() {
    if (!this.dbManager) return;
    await this.dbManager.ensureConnection();
  }

  /**
   * Execute a database operation with automatic retry on closed database error
   * @param {Function} operation - Async function to execute
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, operationName) {
    if (!this.dbManager) {
      throw new Error('No database connection for poll operation');
    }
    return await this.dbManager.executeWithRetry(operation, operationName);
  }

  /**
   * Handle authentication errors from API calls.
   * Persists consecutive count in master DB so it survives poller teardown between cycles.
   * @param {Error} error - The authentication error
   * @throws {Error} - Re-throws with enhanced error information
   */
  async handleAuthenticationError(error) {
    const threshold = Math.max(1, parseInt(process.env.AUTH_FAILURE_DEACTIVATE_AFTER || '3', 10));
    let consecutiveAuthFailures = 0;
    if (this.masterDb && this.masterDb.incrementConsecutiveAuthFailures) {
      consecutiveAuthFailures = this.masterDb.incrementConsecutiveAuthFailures(this.authId);
    }

    logger.error('API authentication failed - API key may be invalid or expired', error, {
      authId: this.authId,
      errorMessage: error.message,
      status: error.status,
      errorCode: error.responseData?.error,
      detail: error.responseData?.detail,
      consecutiveAuthFailures,
      deactivateThreshold: threshold,
    });

    if (
      consecutiveAuthFailures >= threshold &&
      this.masterDb &&
      this.masterDb.updateUserStatus
    ) {
      try {
        this.masterDb.updateUserStatus(this.authId, 'inactive');
        logger.warn('Marked user as inactive due to consecutive authentication errors', {
          authId: this.authId,
          consecutiveFailures: consecutiveAuthFailures,
        });
      } catch (dbError) {
        logger.error('Failed to update user status', dbError, {
          authId: this.authId,
        });
      }
    }

    // Throw a more descriptive error
    const authError = new Error(
      `API authentication failed: ${error.message || 'Invalid or expired API key'}`
    );
    authError.name = 'AuthenticationError';
    authError.isAuthError = true;
    throw authError;
  }

  /**
   * Fetch torrents from the API
   * @returns {Promise<Array>} - Array of torrent objects
   */
  async fetchTorrents() {
    const apiFetchStart = Date.now();
    logger.debug('Fetching torrents from API', { authId: this.authId });

    try {
      const torrents = await this.apiClient.getTorrents(true); // bypass cache
      const apiFetchDuration = ((Date.now() - apiFetchStart) / 1000).toFixed(2);
      logger.debug('Torrents fetched from API', {
        authId: this.authId,
        torrentCount: torrents.length,
        apiFetchDuration: `${apiFetchDuration}s`,
      });
      return torrents;
    } catch (error) {
      const apiFetchDuration = ((Date.now() - apiFetchStart) / 1000).toFixed(2);

      // Connection error (network failure, 5xx, axios timeout): TorBox API is unreachable.
      // Propagate a clearly-tagged error so poll() can skip shadow-state processing entirely.
      // This prevents processSnapshot([]) from wrongly marking all torrents as "removed" and
      // pushing the user into 60-min idle polling mode during an outage.
      if (error.isConnectionError) {
        logger.warn('TorBox API unreachable during torrent fetch — poll will be skipped', {
          authId: this.authId,
          errorMessage: error.message,
          apiFetchDuration: `${apiFetchDuration}s`,
        });
        throw error; // error.isConnectionError is already true (tagged by ApiClient)
      }

      // Check if this is an authentication error
      if (error.isAuthError || error.name === 'AuthenticationError') {
        await this.handleAuthenticationError(error);
      }

      const isPlanRestricted =
        error.response?.status === 403 && error.response?.data?.error === 'PLAN_RESTRICTED_FEATURE';
      const logPayload = {
        authId: this.authId,
        errorMessage: error.message,
        apiFetchDuration: `${apiFetchDuration}s`,
      };
      if (isPlanRestricted) {
        logger.info('Failed to fetch torrents from API', logPayload);
      } else {
        logger.error('Failed to fetch torrents from API', error, logPayload);
      }
      throw error;
    }
  }

  /**
   * Process state changes from torrent snapshot
   * @param {Array} torrents - Array of torrent objects
   * @returns {Promise<Object>} - Object with new, updated, and removed torrents
   */
  async processStateChanges(torrents) {
    if (!Array.isArray(torrents)) {
      logger.warn('processStateChanges called with non-array', {
        authId: this.authId,
        torrentsType: typeof torrents,
      });
      return { new: [], updated: [], removed: [], stateTransitions: [] };
    }

    const diffStart = Date.now();
    logger.debug('Processing state diff', {
      authId: this.authId,
      torrentCount: torrents.length,
    });

    try {
      const changes = await this.executeWithRetry(() => {
        const stateDiffEngine = this.dbManager.getStateDiffEngine();
        return stateDiffEngine.processSnapshot(torrents);
      }, 'processSnapshot');

      const diffDuration = ((Date.now() - diffStart) / 1000).toFixed(2);
      logger.debug('State diff processed', {
        authId: this.authId,
        new: changes.new?.length || 0,
        updated: changes.updated?.length || 0,
        removed: changes.removed?.length || 0,
        stateTransitions: changes.stateTransitions?.length || 0,
        diffDuration: `${diffDuration}s`,
      });
      return changes;
    } catch (error) {
      logger.error('Failed to process state diff', error, {
        authId: this.authId,
        torrentCount: torrents.length,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update derived fields for changed torrents
   * @param {Object} changes - Object with new, updated, and removed torrents
   * @returns {Promise<void>}
   */
  async updateDerivedFields(changes) {
    if (!changes || typeof changes !== 'object') {
      logger.warn('updateDerivedFields called with invalid changes object', {
        authId: this.authId,
        changesType: typeof changes,
      });
      return;
    }

    const derivedStart = Date.now();
    logger.debug('Updating derived fields', {
      authId: this.authId,
      newCount: changes.new?.length || 0,
      updatedCount: changes.updated?.length || 0,
      removedCount: changes.removed?.length || 0,
    });

    try {
      await this.executeWithRetry(() => {
        const derivedFieldsEngine = this.dbManager.getDerivedFieldsEngine();
        return derivedFieldsEngine.updateDerivedFields(changes, 5 * 60);
      }, 'updateDerivedFields');

      const derivedDuration = ((Date.now() - derivedStart) / 1000).toFixed(2);
      logger.debug('Derived fields updated', {
        authId: this.authId,
        derivedDuration: `${derivedDuration}s`,
      });
    } catch (error) {
      logger.error('Failed to update derived fields', error, {
        authId: this.authId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Process speed updates for updated torrents
   * @param {Array} updatedTorrents - Array of updated torrent objects
   * @returns {Promise<void>}
   */
  async processSpeedUpdates(updatedTorrents) {
    if (updatedTorrents.length === 0) {
      return;
    }

    const speedStart = Date.now();
    logger.debug('Processing speed updates', {
      authId: this.authId,
      updatedCount: updatedTorrents.length,
    });

    try {
      await this.executeWithRetry(() => {
        const speedAggregator = this.dbManager.getSpeedAggregator();
        return speedAggregator.processUpdates(updatedTorrents);
      }, 'processUpdates');

      const speedDuration = ((Date.now() - speedStart) / 1000).toFixed(2);
      logger.debug('Speed updates processed', {
        authId: this.authId,
        speedDuration: `${speedDuration}s`,
      });
    } catch (error) {
      logger.error('Failed to process speed updates', error, {
        authId: this.authId,
        updatedCount: updatedTorrents.length,
        errorMessage: error.message,
      });
      // Don't throw - speed updates are not critical
    }
  }

  /**
   * Evaluate automation rules for torrents
   * @param {Array} torrents - Array of torrent objects
   * @returns {Promise<Object>} - Object with evaluated and executed counts
   */
  async evaluateRules(torrents) {
    const rulesStart = Date.now();
    let ruleResults = { evaluated: 0, executed: 0 };

    if (!this.automationEngine) {
      logger.warn('No automation engine available for rule evaluation', {
        authId: this.authId,
      });
      return ruleResults;
    }

    logger.debug('Evaluating automation rules', {
      authId: this.authId,
      torrentCount: torrents.length,
    });

    try {
      ruleResults = await this.automationEngine.evaluateRules(torrents);
      const rulesDuration = ((Date.now() - rulesStart) / 1000).toFixed(2);
      logger.debug('Automation rules evaluated', {
        authId: this.authId,
        evaluated: ruleResults.evaluated,
        executed: ruleResults.executed,
        rulesDuration: `${rulesDuration}s`,
      });
    } catch (error) {
      logger.error('Failed to evaluate automation rules', error, {
        authId: this.authId,
        torrentCount: torrents.length,
        errorMessage: error.message,
      });
      // Don't throw - rule evaluation errors are logged but don't fail the poll
    }

    return ruleResults;
  }

  /**
   * Update master database with poll results
   * @param {Date} nextPollAt - Next poll timestamp
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @returns {Promise<void>}
   */
  async updateMasterDatabase(nextPollAt, nonTerminalCount) {
    if (!this.masterDb) {
      return;
    }

    try {
      this.masterDb.updateNextPollAt(this.authId, nextPollAt, nonTerminalCount);
      logger.debug('Updated next poll time in master DB', {
        authId: this.authId,
        nextPollAt: nextPollAt.toISOString(),
        nonTerminalCount,
      });
    } catch (error) {
      logger.error('Failed to update next poll time in master DB', error, {
        authId: this.authId,
        errorMessage: error.message,
      });
      // Don't throw - DB update failure shouldn't fail the poll
    }
  }

  /**
   * Single canonical pipeline: optionally fetch, then state diff → derived fields → speed → rule eval → next poll.
   * Used by both the two-phase scheduler (with prefetchedTorrents) and triggerPoll (fetches inside).
   * @param {Object} options - Options
   * @param {Array} [options.prefetchedTorrents] - If provided, skip API fetch and use this list
   * @param {boolean} options.hasActiveRules - Whether user has active rules
   * @param {Function|null} [options.calculateStaggerOffset] - Optional stagger calculator
   * @param {boolean} [options.updateMasterDb=false] - Whether to write next_poll_at to master DB
   * @param {Function} [options.checkCancelled] - Optional no-arg function that throws if poll was cancelled
   * @returns {Promise<Object>} - { success, changes, ruleResults, nextPollAt, nonTerminalCount }
   */
  async runPipeline(options = {}) {
    const {
      prefetchedTorrents,
      hasActiveRules,
      calculateStaggerOffset = null,
      updateMasterDb = false,
      checkCancelled = null,
    } = options;

    if (!this.dbManager && this.userDatabaseManager) {
      const userDbConnection = await this.userDatabaseManager.getUserDatabase(this.authId);
      if (userDbConnection?.db) {
        this.dbManager = new DatabaseConnectionManager(
          this.authId,
          userDbConnection.db,
          this.userDatabaseManager
        );
        this.userDatabaseManager.pool.markActive(this.authId);
      }
    }

    await this.ensureDatabaseConnection();
    if (!this.dbManager) {
      throw new Error('No database connection for runPipeline');
    }

    let torrents = prefetchedTorrents;
    if (torrents === undefined) {
      torrents = await this.fetchTorrents();
      if (checkCancelled) checkCancelled();
    }
    if (!Array.isArray(torrents)) {
      throw new Error('Torrents must be an array');
    }

    const changes = await this.processStateChanges(torrents);
    if (checkCancelled) checkCancelled();
    if (!changes || typeof changes !== 'object') {
      throw new Error('processStateChanges returned invalid changes object');
    }
    if (!Array.isArray(changes.new)) changes.new = [];
    if (!Array.isArray(changes.updated)) changes.updated = [];
    if (!Array.isArray(changes.removed)) changes.removed = [];
    if (!Array.isArray(changes.stateTransitions)) changes.stateTransitions = [];

    await this.updateDerivedFields(changes);
    if (checkCancelled) checkCancelled();
    await this.processSpeedUpdates(changes.updated);
    if (checkCancelled) checkCancelled();

    const ruleResults = await this.evaluateRules(torrents);
    if (checkCancelled) checkCancelled();
    const nonTerminalCount = this.countNonTerminalTorrents(torrents, changes);
    const nextPollAt = await this.calculateNextPollAt(
      nonTerminalCount,
      hasActiveRules,
      calculateStaggerOffset,
      ruleResults
    );

    if (updateMasterDb) {
      await this.updateMasterDatabase(nextPollAt, nonTerminalCount);
    }

    return {
      success: true,
      changes,
      ruleResults,
      nextPollAt,
      nonTerminalCount,
    };
  }

  /**
   * Process already-fetched torrents (state diff, derived fields, speed updates, rule evaluation).
   * Used by the two-phase scheduler: Stage 1 fetches torrents, Stage 2 calls this with no API calls.
   * @param {Array} torrents - Array of torrent objects from API
   * @param {Object} options - Options
   * @param {boolean} options.hasActiveRules - Whether user has active rules
   * @param {Function|null} [options.calculateStaggerOffset] - Optional stagger calculator
   * @returns {Promise<Object>} - { success, changes, ruleResults, nextPollAt, nonTerminalCount }
   */
  async processFetchedTorrents(torrents, options = {}) {
    if (!Array.isArray(torrents)) {
      throw new Error('processFetchedTorrents requires an array of torrents');
    }
    return this.runPipeline({
      prefetchedTorrents: torrents,
      hasActiveRules: options.hasActiveRules,
      calculateStaggerOffset: options.calculateStaggerOffset ?? null,
      updateMasterDb: false,
    });
  }

  /**
   * Execute a single poll cycle
   * @param {boolean} [cachedHasActiveRules] - Optional cached hasActiveRules value to avoid redundant DB calls
   * @param {Object} [options] - Poll options
   * @param {Function|null} [options.calculateStaggerOffset] - Optional stagger calculator
   * @param {boolean} [options.updateMasterDb=true] - Whether to persist next_poll_at in the poller
   */
  async poll(cachedHasActiveRules = null, options = {}) {
    const { calculateStaggerOffset = null, updateMasterDb = true } = options;
    if (this.isPolling) {
      logger.warn('Skipping poll - previous poll still running', {
        authId: this.authId,
        lastPollAt: this.lastPollAt,
        lastPollError: this.lastPollError,
      });
      return {
        success: false,
        error: 'Previous poll still running',
        skipped: true,
      };
    }

    // Acquire DB connection for this poll cycle (released in finally); avoids holding connections between polls (min interval 30+ min)
    if (!this.dbManager && this.userDatabaseManager) {
      try {
        const userDbConnection = await this.userDatabaseManager.getUserDatabase(this.authId);
        if (userDbConnection?.db) {
          this.dbManager = new DatabaseConnectionManager(
            this.authId,
            userDbConnection.db,
            this.userDatabaseManager
          );
          this.userDatabaseManager.pool.markActive(this.authId);
        }
      } catch (error) {
        logger.error('Failed to get user database for poll', error, {
          authId: this.authId,
          errorMessage: error.message,
        });
        return {
          success: false,
          error: `Database connection error: ${error.message}`,
          skipped: false,
        };
      }
    }

    // Ensure database connection is valid before starting poll
    try {
      await this.ensureDatabaseConnection();
    } catch (error) {
        logger.error('Failed to ensure database connection', error, {
          authId: this.authId,
          errorMessage: error.message,
        });
      if (this.userDatabaseManager) {
        this.userDatabaseManager.closeConnection(this.authId);
      }
      this.dbManager = null;
      return {
        success: false,
        error: `Database connection error: ${error.message}`,
        skipped: false,
      };
    }

    // Check if user has active automation rules (use cached value if provided)
    const hasActiveRules =
      cachedHasActiveRules !== null ? cachedHasActiveRules : await this.shouldPoll();
    if (!hasActiveRules) {
      logger.debug('Poll skipped - no active automation rules', {
        authId: this.authId,
        hasAutomationEngine: !!this.automationEngine,
      });
      if (this.userDatabaseManager) {
        this.userDatabaseManager.closeConnection(this.authId);
      }
      this.dbManager = null;
      return {
        success: true,
        skipped: true,
        reason: 'No active automation rules',
      };
    }

    this.isPolling = true;
    const myGeneration = ++this._pollGeneration;
    const cancelToken = this._newCancelToken();
    const startTime = Date.now();
    const pollStartTime = new Date();

    try {
      logger.info('Starting poll cycle', {
        authId: this.authId,
        timestamp: pollStartTime.toISOString(),
        lastPollAt: this.lastPollAt,
        hasAutomationEngine: !!this.automationEngine,
      });

      const result = await this.runPipeline({
        hasActiveRules,
        calculateStaggerOffset,
        updateMasterDb,
        checkCancelled: () => this._checkCancelled(cancelToken),
      });

      this.lastPollAt = new Date();
      this.lastPolledAt = new Date();
      this.lastPollError = null;
      if (this.masterDb && this.masterDb.resetConsecutiveAuthFailures) {
        this.masterDb.resetConsecutiveAuthFailures(this.authId);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('Poll completed successfully', {
        authId: this.authId,
        duration: `${duration}s`,
        new: result.changes.new?.length || 0,
        updated: result.changes.updated?.length || 0,
        removed: result.changes.removed?.length || 0,
        stateTransitions: result.changes.stateTransitions?.length || 0,
        rulesEvaluated: result.ruleResults?.evaluated || 0,
        rulesExecuted: result.ruleResults?.executed || 0,
        nonTerminalCount: result.nonTerminalCount || 0,
        hasActiveRules,
        nextPollAt: result.nextPollAt?.toISOString() || 'unknown',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        changes: result.changes,
        ruleResults: result.ruleResults,
        duration: parseFloat(duration),
        nonTerminalCount: result.nonTerminalCount,
        nextPollAt: result.nextPollAt,
      };
    } catch (error) {
      if (error.isCancelled) {
        // Poll was cancelled by the scheduler timeout — exit quietly without updating next_poll_at
        // (the scheduler has already handled that via handlePollTimeout)
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.debug('Poll cancelled after scheduler timeout', {
          authId: this.authId,
          duration: `${duration}s`,
        });
        return { success: false, error: 'cancelled', duration: parseFloat(duration) };
      }

      if (error.isConnectionError) {
        // TorBox API is unreachable (network failure, 5xx, timeout).
        // Shadow state was NOT modified — no harm done. Let the scheduler apply a fast retry.
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        return {
          success: false,
          isConnectionError: true,
          error: error.message,
          duration: parseFloat(duration),
        };
      }

      this.lastPollError = error.message;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const isPlanRestricted =
        error.response?.status === 403 && error.response?.data?.error === 'PLAN_RESTRICTED_FEATURE';
      if (isPlanRestricted && this.automationEngine) {
        try {
          const disabledCount = await this.automationEngine.disableAllRules();
          logger.info('Poll failed (plan restricted); disabled all automation rules', {
            authId: this.authId,
            duration: `${duration}s`,
            disabledCount,
          });
        } catch (disableErr) {
          logger.error('Failed to disable rules after plan restricted', disableErr, {
            authId: this.authId,
          });
          logger.info('Poll failed', {
            authId: this.authId,
            duration: `${duration}s`,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        const pollFailPayload = {
          authId: this.authId,
          duration: `${duration}s`,
          errorMessage: error.message,
          errorStack: error.stack,
          timestamp: new Date().toISOString(),
        };
        if (isPlanRestricted) {
          logger.info('Poll failed', pollFailPayload);
        } else {
          logger.error('Poll failed', error, pollFailPayload);
        }
      }

      return {
        success: false,
        error: error.message,
        duration: parseFloat(duration),
      };
    } finally {
      // Only clear isPolling if this poll is still the current one (avoids zombie poll clearing it after timeout + new poll)
      if (this._pollGeneration === myGeneration) {
        this.isPolling = false;
      }
      // Close connection after poll so we don't hold 100s of idle connections; next poll will open fresh
      if (this.userDatabaseManager) {
        this.userDatabaseManager.closeConnection(this.authId);
      }
      this.dbManager = null;
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.debug('Poll cycle finished', {
        authId: this.authId,
        totalDuration: `${totalDuration}s`,
        isPolling: this.isPolling,
      });
    }
  }

  /**
   * Reset polling state so the next poll can run.
   * Called by the scheduler when a poll times out; the timed-out poll keeps running in the background
   * but isPolling is cleared so the next scheduled poll is not skipped.
   * Also cancels the timed-out poll's token so it exits at its next await checkpoint.
   */
  resetPollingState() {
    this.isPolling = false;
    if (this._cancelToken) {
      this._cancelToken.cancelled = true;
      this._cancelToken = null;
    }
  }

  /**
   * Create a new cancellation token for the current poll and return it.
   * The previous token (if any) is automatically cancelled.
   * @returns {{ cancelled: boolean }}
   */
  _newCancelToken() {
    if (this._cancelToken) {
      this._cancelToken.cancelled = true;
    }
    this._cancelToken = { cancelled: false };
    return this._cancelToken;
  }

  /**
   * Throw a CancelledError if the given token has been cancelled.
   * @param {{ cancelled: boolean }} token
   */
  _checkCancelled(token) {
    if (token.cancelled) {
      const err = new Error('Poll cancelled by timeout');
      err.name = 'CancelledError';
      err.isCancelled = true;
      throw err;
    }
  }

  /**
   * Get poller status
   */
  getStatus() {
    return {
      authId: this.authId,
      isPolling: this.isPolling,
      lastPollAt: this.lastPollAt ? this.lastPollAt.toISOString() : null,
      lastPolledAt: this.lastPolledAt ? this.lastPolledAt.toISOString() : null,
      lastPollError: this.lastPollError,
      hasAutomationEngine: !!this.automationEngine,
      hasMasterDb: !!this.masterDb,
      hasUserDatabaseManager: !!this.dbManager?.userDatabaseManager,
    };
  }
}

export default UserPoller;
