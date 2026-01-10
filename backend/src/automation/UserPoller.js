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
  shouldPoll() {
    if (!this.automationEngine) {
      return false;
    }
    return this.automationEngine.hasActiveRules();
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
      logger.warn('Skipping poll - previous poll still running', { authId: this.authId });
      return;
    }

    // Check if user has active automation rules
    if (!this.shouldPoll()) {
      return {
        success: true,
        skipped: true,
        reason: 'No active automation rules'
      };
    }

    this.isPolling = true;
    const startTime = new Date();

    try {
      logger.debug('Starting poll', { authId: this.authId });
      
      // Fetch torrents from API
      const torrents = await this.apiClient.getTorrents(true); // bypass cache
      
      // Process snapshot and compute diffs
      const changes = await this.stateDiffEngine.processSnapshot(torrents);
      
      // Update derived fields (use 5 minutes as default interval for calculation)
      await this.derivedFieldsEngine.updateDerivedFields(
        changes,
        5 * 60 // 5 minutes in seconds
      );
      
      // Record speed samples for updated torrents
      if (changes.updated.length > 0) {
        await this.speedAggregator.processUpdates(changes.updated);
      }
      
      // Evaluate automation rules
      let ruleResults = { evaluated: 0, executed: 0 };
      if (this.automationEngine) {
        ruleResults = await this.automationEngine.evaluateRules(torrents);
      }
      
      // Count non-terminal torrents and update master DB
      const nonTerminalCount = this.countNonTerminalTorrents(torrents);
      const hasActiveRules = this.automationEngine ? this.automationEngine.hasActiveRules() : false;
      
      // Calculate next poll time (stagger will be added by scheduler if available)
      const nextPollAt = this.calculateNextPollAt(nonTerminalCount, hasActiveRules);
      
      // Update master DB with next poll time and torrent count
      if (this.masterDb) {
        this.masterDb.updateNextPollAt(this.authId, nextPollAt, nonTerminalCount);
      }
      
      this.lastPollAt = new Date();
      this.lastPollError = null;
      
      const duration = (new Date() - startTime) / 1000;
      logger.info('Poll completed', {
        authId: this.authId,
        duration: `${duration.toFixed(2)}s`,
        new: changes.new.length,
        updated: changes.updated.length,
        removed: changes.removed.length,
        rulesEvaluated: ruleResults.evaluated,
        rulesExecuted: ruleResults.executed,
        nonTerminalCount,
        nextPollAt: nextPollAt.toISOString(),
      });
      
      return {
        success: true,
        changes,
        ruleResults,
        duration,
        nonTerminalCount,
        nextPollAt
      };
    } catch (error) {
      this.lastPollError = error.message;
      logger.error('Poll failed', error, { authId: this.authId });
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isPolling = false;
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

