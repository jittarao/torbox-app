import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import PollingIntervalCalculator from './helpers/PollingIntervalCalculator.js';
import DatabaseConnectionManager from './helpers/DatabaseConnectionManager.js';

/**
 * Per-user poller
 * Handles polling and state updates for a single user
 */
class UserPoller {
  constructor(
    authId,
    encryptedApiKey,
    userDb,
    automationEngine = null,
    masterDb = null,
    userDatabaseManager = null
  ) {
    this.authId = authId;
    this.encryptedApiKey = encryptedApiKey;
    this.masterDb = masterDb;
    this.automationEngine = automationEngine;
    this.isPolling = false;
    this.lastPollAt = null;
    this.lastPolledAt = null; // Track when poller was last used (for cleanup)
    this.lastPollError = null;

    // Decrypt API key
    this.apiKey = decrypt(encryptedApiKey);
    this.apiClient = new ApiClient(this.apiKey);

    // Initialize database connection manager (handles engines and connection refresh)
    this.dbManager = new DatabaseConnectionManager(authId, userDb, userDatabaseManager);
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
   * Count non-terminal torrents
   * @param {Array} torrents - Array of torrent objects
   * @returns {number} - Count of non-terminal torrents
   */
  countNonTerminalTorrents(torrents) {
    const stateDiffEngine = this.dbManager.getStateDiffEngine();
    let count = 0;
    for (const torrent of torrents) {
      const state = stateDiffEngine.getTorrentState(torrent);
      if (!stateDiffEngine.isTerminalState(state)) {
        count++;
      }
    }
    return count;
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

    // If no executions in current poll, check database for executions in last hour
    if (this.automationEngine) {
      try {
        const hasRecentExecutions = await this.automationEngine.hasRecentRuleExecutions(1); // Last hour
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

    // Get minimum rule interval if in active mode
    const minRuleInterval =
      pollingMode === 'active' ? await this.getMinimumRuleIntervalSafe() : null;

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
    await this.dbManager.ensureConnection();
  }

  /**
   * Execute a database operation with automatic retry on closed database error
   * @param {Function} operation - Async function to execute
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, operationName) {
    return await this.dbManager.executeWithRetry(operation, operationName);
  }

  /**
   * Handle authentication errors from API calls
   * @param {Error} error - The authentication error
   * @throws {Error} - Re-throws with enhanced error information
   */
  async handleAuthenticationError(error) {
    logger.error('API authentication failed - API key may be invalid or expired', error, {
      authId: this.authId,
      errorMessage: error.message,
      status: error.status,
      errorCode: error.responseData?.error,
      detail: error.responseData?.detail,
    });

    // Mark user status as inactive if masterDb is available to prevent further polling
    if (this.masterDb && this.masterDb.updateUserStatus) {
      try {
        this.masterDb.updateUserStatus(this.authId, 'inactive');
        logger.warn('Marked user as inactive due to authentication error', {
          authId: this.authId,
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
      // Check if this is an authentication error
      if (error.isAuthError || error.name === 'AuthenticationError') {
        await this.handleAuthenticationError(error);
      }

      logger.error('Failed to fetch torrents from API', error, {
        authId: this.authId,
        errorMessage: error.message,
        apiFetchDuration: `${((Date.now() - apiFetchStart) / 1000).toFixed(2)}s`,
      });
      throw error;
    }
  }

  /**
   * Process state changes from torrent snapshot
   * @param {Array} torrents - Array of torrent objects
   * @returns {Promise<Object>} - Object with new, updated, and removed torrents
   */
  async processStateChanges(torrents) {
    const diffStart = Date.now();
    logger.debug('Processing state diff', { authId: this.authId });

    try {
      const stateDiffEngine = this.dbManager.getStateDiffEngine();
      const changes = await this.executeWithRetry(
        () => stateDiffEngine.processSnapshot(torrents),
        'processSnapshot'
      );

      const diffDuration = ((Date.now() - diffStart) / 1000).toFixed(2);
      logger.debug('State diff processed', {
        authId: this.authId,
        new: changes.new.length,
        updated: changes.updated.length,
        removed: changes.removed.length,
        diffDuration: `${diffDuration}s`,
      });
      return changes;
    } catch (error) {
      logger.error('Failed to process state diff', error, {
        authId: this.authId,
        torrentCount: torrents.length,
        errorMessage: error.message,
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
    const derivedStart = Date.now();
    logger.debug('Updating derived fields', { authId: this.authId });

    try {
      const derivedFieldsEngine = this.dbManager.getDerivedFieldsEngine();
      await this.executeWithRetry(
        () => derivedFieldsEngine.updateDerivedFields(changes, 5 * 60),
        'updateDerivedFields'
      );

      const derivedDuration = ((Date.now() - derivedStart) / 1000).toFixed(2);
      logger.debug('Derived fields updated', {
        authId: this.authId,
        derivedDuration: `${derivedDuration}s`,
      });
    } catch (error) {
      logger.error('Failed to update derived fields', error, {
        authId: this.authId,
        errorMessage: error.message,
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
      const speedAggregator = this.dbManager.getSpeedAggregator();
      await this.executeWithRetry(
        () => speedAggregator.processUpdates(updatedTorrents),
        'processUpdates'
      );

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
   * Execute a single poll cycle
   * @param {boolean} [cachedHasActiveRules] - Optional cached hasActiveRules value to avoid redundant DB calls
   */
  async poll(cachedHasActiveRules = null) {
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

    // Ensure database connection is valid before starting poll
    try {
      await this.ensureDatabaseConnection();
    } catch (error) {
      logger.error('Failed to ensure database connection', error, {
        authId: this.authId,
        errorMessage: error.message,
      });
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
      return {
        success: true,
        skipped: true,
        reason: 'No active automation rules',
      };
    }

    this.isPolling = true;
    const startTime = Date.now();
    const pollStartTime = new Date();

    try {
      logger.info('Starting poll cycle', {
        authId: this.authId,
        timestamp: pollStartTime.toISOString(),
        lastPollAt: this.lastPollAt,
        hasAutomationEngine: !!this.automationEngine,
      });

      // Fetch torrents from API
      const torrents = await this.fetchTorrents();

      // Process snapshot and compute diffs
      const changes = await this.processStateChanges(torrents);

      // Update derived fields
      await this.updateDerivedFields(changes);

      // Record speed samples for updated torrents
      await this.processSpeedUpdates(changes.updated);

      // Evaluate automation rules
      const ruleResults = await this.evaluateRules(torrents);

      // Count non-terminal torrents and calculate next poll time
      const nonTerminalCount = this.countNonTerminalTorrents(torrents);
      const nextPollAt = await this.calculateNextPollAt(
        nonTerminalCount,
        hasActiveRules,
        null, // calculateStaggerOffset will be provided by scheduler
        ruleResults
      );

      // Update master DB with next poll time and torrent count
      await this.updateMasterDatabase(nextPollAt, nonTerminalCount);

      this.lastPollAt = new Date();
      this.lastPolledAt = new Date(); // Update last polled timestamp
      this.lastPollError = null;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info('Poll completed successfully', {
        authId: this.authId,
        duration: `${duration}s`,
        new: changes.new.length,
        updated: changes.updated.length,
        removed: changes.removed.length,
        rulesEvaluated: ruleResults.evaluated,
        rulesExecuted: ruleResults.executed,
        nonTerminalCount,
        hasActiveRules: hasActiveRules,
        nextPollAt: nextPollAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        changes,
        ruleResults,
        duration: parseFloat(duration),
        nonTerminalCount,
        nextPollAt,
      };
    } catch (error) {
      this.lastPollError = error.message;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error('Poll failed', error, {
        authId: this.authId,
        duration: `${duration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: error.message,
        duration: parseFloat(duration),
      };
    } finally {
      this.isPolling = false;
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.debug('Poll cycle finished', {
        authId: this.authId,
        totalDuration: `${totalDuration}s`,
        isPolling: this.isPolling,
      });
    }
  }

  /**
   * Get poller status
   */
  getStatus() {
    return {
      authId: this.authId,
      isPolling: this.isPolling,
      lastPollAt: this.lastPollAt,
      lastPollError: this.lastPollError,
    };
  }
}

export default UserPoller;
