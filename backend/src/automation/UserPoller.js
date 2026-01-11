import ApiClient from '../api/ApiClient.js';
import StateDiffEngine from './StateDiffEngine.js';
import DerivedFieldsEngine from './DerivedFieldsEngine.js';
import SpeedAggregator from './SpeedAggregator.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';

/**
 * Per-user poller
 * Handles polling and state updates for a single user
 */
class UserPoller {
  constructor(authId, encryptedApiKey, userDb, automationEngine = null, masterDb = null) {
    this.authId = authId;
    this.encryptedApiKey = encryptedApiKey;
    this.userDb = userDb;
    this.masterDb = masterDb;
    this.isPolling = false;
    this.lastPollAt = null;
    this.lastPollError = null;
    
    // Decrypt API key
    this.apiKey = decrypt(encryptedApiKey);
    this.apiClient = new ApiClient(this.apiKey);
    
    // Initialize engines
    this.stateDiffEngine = new StateDiffEngine(userDb);
    this.derivedFieldsEngine = new DerivedFieldsEngine(userDb);
    this.speedAggregator = new SpeedAggregator(userDb);
    this.automationEngine = automationEngine;
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
    let count = 0;
    for (const torrent of torrents) {
      const state = this.stateDiffEngine.getTorrentState(torrent);
      if (!this.stateDiffEngine.isTerminalState(state)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate next poll timestamp based on state
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @param {boolean} hasActiveRules - Whether user has active rules
   * @param {Function} calculateStaggerOffset - Function to calculate stagger offset
   * @returns {Date} - Next poll timestamp
   */
  calculateNextPollAt(nonTerminalCount, hasActiveRules, calculateStaggerOffset = null) {
    const now = Date.now();
    let baseIntervalMinutes;

    if (!hasActiveRules) {
      // No active rules: poll every hour
      baseIntervalMinutes = 60;
    } else if (nonTerminalCount > 0) {
      // Has active rules and non-terminal torrents: poll every 5 minutes
      baseIntervalMinutes = 5;
    } else {
      // Has active rules but no non-terminal torrents: poll every 30 minutes
      baseIntervalMinutes = 30;
    }

    const baseIntervalMs = baseIntervalMinutes * 60 * 1000;
    
    // Add stagger offset if provided
    let staggerOffset = 0;
    if (calculateStaggerOffset) {
      staggerOffset = calculateStaggerOffset(this.authId, baseIntervalMinutes);
    }

    return new Date(now + baseIntervalMs + staggerOffset);
  }

  /**
   * Execute a single poll cycle
   */
  async poll() {
    if (this.isPolling) {
      logger.warn('Skipping poll - previous poll still running', { 
        authId: this.authId,
        lastPollAt: this.lastPollAt,
        lastPollError: this.lastPollError
      });
      return {
        success: false,
        error: 'Previous poll still running',
        skipped: true
      };
    }

    // Check if user has active automation rules
    const hasActiveRules = await this.shouldPoll();
    if (!hasActiveRules) {
      logger.debug('Poll skipped - no active automation rules', {
        authId: this.authId,
        hasAutomationEngine: !!this.automationEngine
      });
      return {
        success: true,
        skipped: true,
        reason: 'No active automation rules'
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
        hasAutomationEngine: !!this.automationEngine
      });
      
      // Fetch torrents from API
      const apiFetchStart = Date.now();
      logger.debug('Fetching torrents from API', { authId: this.authId });
      let torrents;
      try {
        torrents = await this.apiClient.getTorrents(true); // bypass cache
        const apiFetchDuration = ((Date.now() - apiFetchStart) / 1000).toFixed(2);
        logger.debug('Torrents fetched from API', {
          authId: this.authId,
          torrentCount: torrents.length,
          apiFetchDuration: `${apiFetchDuration}s`
        });
      } catch (error) {
        logger.error('Failed to fetch torrents from API', error, {
          authId: this.authId,
          errorMessage: error.message,
          apiFetchDuration: `${((Date.now() - apiFetchStart) / 1000).toFixed(2)}s`
        });
        throw error;
      }
      
      // Process snapshot and compute diffs
      const diffStart = Date.now();
      logger.debug('Processing state diff', { authId: this.authId });
      let changes;
      try {
        changes = await this.stateDiffEngine.processSnapshot(torrents);
        const diffDuration = ((Date.now() - diffStart) / 1000).toFixed(2);
        logger.debug('State diff processed', {
          authId: this.authId,
          new: changes.new.length,
          updated: changes.updated.length,
          removed: changes.removed.length,
          diffDuration: `${diffDuration}s`
        });
      } catch (error) {
        logger.error('Failed to process state diff', error, {
          authId: this.authId,
          torrentCount: torrents.length,
          errorMessage: error.message
        });
        throw error;
      }
      
      // Update derived fields (use 5 minutes as default interval for calculation)
      const derivedStart = Date.now();
      logger.debug('Updating derived fields', { authId: this.authId });
      try {
        await this.derivedFieldsEngine.updateDerivedFields(
          changes,
          5 * 60 // 5 minutes in seconds
        );
        const derivedDuration = ((Date.now() - derivedStart) / 1000).toFixed(2);
        logger.debug('Derived fields updated', {
          authId: this.authId,
          derivedDuration: `${derivedDuration}s`
        });
      } catch (error) {
        logger.error('Failed to update derived fields', error, {
          authId: this.authId,
          errorMessage: error.message
        });
        throw error;
      }
      
      // Record speed samples for updated torrents
      if (changes.updated.length > 0) {
        const speedStart = Date.now();
        logger.debug('Processing speed updates', {
          authId: this.authId,
          updatedCount: changes.updated.length
        });
        try {
          await this.speedAggregator.processUpdates(changes.updated);
          const speedDuration = ((Date.now() - speedStart) / 1000).toFixed(2);
          logger.debug('Speed updates processed', {
            authId: this.authId,
            speedDuration: `${speedDuration}s`
          });
        } catch (error) {
          logger.error('Failed to process speed updates', error, {
            authId: this.authId,
            updatedCount: changes.updated.length,
            errorMessage: error.message
          });
          // Don't throw - speed updates are not critical
        }
      }
      
      // Evaluate automation rules
      const rulesStart = Date.now();
      let ruleResults = { evaluated: 0, executed: 0 };
      if (this.automationEngine) {
        logger.debug('Evaluating automation rules', {
          authId: this.authId,
          torrentCount: torrents.length
        });
        try {
          ruleResults = await this.automationEngine.evaluateRules(torrents);
          const rulesDuration = ((Date.now() - rulesStart) / 1000).toFixed(2);
          logger.debug('Automation rules evaluated', {
            authId: this.authId,
            evaluated: ruleResults.evaluated,
            executed: ruleResults.executed,
            rulesDuration: `${rulesDuration}s`
          });
        } catch (error) {
          logger.error('Failed to evaluate automation rules', error, {
            authId: this.authId,
            torrentCount: torrents.length,
            errorMessage: error.message
          });
          // Don't throw - rule evaluation errors are logged but don't fail the poll
        }
      } else {
        logger.warn('No automation engine available for rule evaluation', {
          authId: this.authId
        });
      }
      
      // Count non-terminal torrents and update master DB
      const nonTerminalCount = this.countNonTerminalTorrents(torrents);
      const hasActiveRulesFlag = this.automationEngine ? await this.automationEngine.hasActiveRules() : false;
      
      // Calculate next poll time (stagger will be added by scheduler if available)
      const nextPollAt = this.calculateNextPollAt(nonTerminalCount, hasActiveRulesFlag);
      
      // Update master DB with next poll time and torrent count
      if (this.masterDb) {
        try {
          this.masterDb.updateNextPollAt(this.authId, nextPollAt, nonTerminalCount);
          logger.debug('Updated next poll time in master DB', {
            authId: this.authId,
            nextPollAt: nextPollAt.toISOString(),
            nonTerminalCount
          });
        } catch (error) {
          logger.error('Failed to update next poll time in master DB', error, {
            authId: this.authId,
            errorMessage: error.message
          });
          // Don't throw - DB update failure shouldn't fail the poll
        }
      }
      
      this.lastPollAt = new Date();
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
        hasActiveRules: hasActiveRulesFlag,
        nextPollAt: nextPollAt.toISOString(),
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        changes,
        ruleResults,
        duration: parseFloat(duration),
        nonTerminalCount,
        nextPollAt
      };
    } catch (error) {
      this.lastPollError = error.message;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error('Poll failed', error, { 
        authId: this.authId,
        duration: `${duration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message,
        duration: parseFloat(duration)
      };
    } finally {
      this.isPolling = false;
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.debug('Poll cycle finished', {
        authId: this.authId,
        totalDuration: `${totalDuration}s`,
        isPolling: this.isPolling
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
      lastPollError: this.lastPollError
    };
  }
}

export default UserPoller;

