import { applyIntervalMultiplier } from '../../utils/intervalUtils.js';
import logger from '../../utils/logger.js';

/**
 * Configuration constants for polling intervals
 * All interval values are in minutes
 * Modify these values to adjust polling behavior across the system
 */
const POLLING_CONFIG = {
  // Base intervals for different polling modes
  intervals: {
    idle: 15, // Idle mode: user has active rules but no recent executions
    active: 5, // Active mode: user has active rules and recent executions with non-terminal torrents
    activeNoTerminal: 30, // Active mode: user has active rules but no non-terminal torrents
    noRules: 60, // No rules mode: user has no active rules
  },

  // Minimum interval constraints
  minimum: {
    production: 5, // Minimum polling interval in production (minutes)
    development: 0.1, // Minimum polling interval multiplier in development (0.1 = 10x faster, 0.01 = 100x faster)
  },
};

/**
 * Calculates polling intervals based on user state and rule execution history
 */
class PollingIntervalCalculator {
  /**
   * Calculate polling interval for idle mode
   * State: User has active rules but no recent executions
   * @param {string} authId - User authentication ID
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @param {Object} ruleResults - Optional rule evaluation results
   * @returns {number} - Polling interval in minutes (adjusted in dev)
   */
  static calculateIdleModeInterval(authId, nonTerminalCount, ruleResults = null) {
    const baseInterval = POLLING_CONFIG.intervals.idle;
    const adjustedInterval = applyIntervalMultiplier(baseInterval);
    logger.debug(
      `User in idle mode (no recent rule executions), polling every ${baseInterval} minutes`,
      {
        authId,
        nonTerminalCount,
        currentPollExecuted: ruleResults?.executed || 0,
        adjustedInterval:
          adjustedInterval !== baseInterval ? `${adjustedInterval.toFixed(2)}min (dev)` : undefined,
      }
    );
    return adjustedInterval;
  }

  /**
   * Calculate polling interval for active mode
   * State: User has active rules and recent executions
   * @param {string} authId - User authentication ID
   * @param {number|null} minRuleInterval - Minimum rule interval from automation engine
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @param {Object} ruleResults - Optional rule evaluation results
   * @returns {number} - Polling interval in minutes
   */
  static calculateActiveModeInterval(
    authId,
    minRuleInterval,
    nonTerminalCount,
    ruleResults = null
  ) {
    if (minRuleInterval !== null) {
      // Use minimum interval from rules with interval triggers (adjusted in dev)
      const adjustedInterval = applyIntervalMultiplier(minRuleInterval);
      logger.debug('User in active mode, using minimum rule interval', {
        authId,
        minRuleInterval,
        adjustedInterval:
          adjustedInterval !== minRuleInterval
            ? `${adjustedInterval.toFixed(2)}min (dev)`
            : undefined,
        nonTerminalCount,
        currentPollExecuted: ruleResults?.executed || 0,
      });
      return adjustedInterval;
    }

    // No interval triggers configured, fallback to existing logic
    if (nonTerminalCount > 0) {
      // Has active rules and non-terminal torrents: poll every N minutes (adjusted in dev)
      return applyIntervalMultiplier(POLLING_CONFIG.intervals.active);
    } else {
      // Has active rules but no non-terminal torrents: poll every N minutes (adjusted in dev)
      return applyIntervalMultiplier(POLLING_CONFIG.intervals.activeNoTerminal);
    }
  }

  /**
   * Apply minimum interval constraint to prevent excessive API calls
   * @param {number} intervalMinutes - Proposed interval in minutes
   * @returns {number} - Enforced minimum interval in minutes
   */
  static applyMinimumIntervalConstraint(intervalMinutes) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const minInterval = isDevelopment
      ? Math.max(
          POLLING_CONFIG.minimum.development,
          applyIntervalMultiplier(POLLING_CONFIG.minimum.production)
        )
      : POLLING_CONFIG.minimum.production;
    return Math.max(minInterval, intervalMinutes);
  }

  /**
   * Calculate next poll timestamp based on state and adaptive polling logic
   *
   * State Machine:
   * - no-rules: User has no active rules -> poll every 60 minutes
   * - idle: User has active rules but no recent executions -> poll every 60 minutes
   * - active: User has active rules and recent executions -> poll based on rule intervals or fallback logic
   *
   * @param {string} authId - User authentication ID
   * @param {string} pollingMode - Current polling mode ('no-rules' | 'idle' | 'active')
   * @param {number} nonTerminalCount - Count of non-terminal torrents
   * @param {number|null} minRuleInterval - Minimum rule interval from automation engine
   * @param {Object} ruleResults - Optional rule evaluation results with execution info
   * @param {Function} calculateStaggerOffset - Optional function to calculate stagger offset
   * @returns {Date} - Next poll timestamp
   */
  static calculateNextPollAt(
    authId,
    pollingMode,
    nonTerminalCount,
    minRuleInterval = null,
    ruleResults = null,
    calculateStaggerOffset = null
  ) {
    const now = Date.now();
    let baseIntervalMinutes;

    // Calculate base interval based on mode
    switch (pollingMode) {
      case 'no-rules':
        // No active rules: poll every N minutes (adjusted in dev)
        baseIntervalMinutes = applyIntervalMultiplier(POLLING_CONFIG.intervals.noRules);
        break;

      case 'idle':
        // Idle mode: No rules executed in current poll or last hour
        // Poll every N minutes regardless of rule intervals (performance optimization)
        baseIntervalMinutes = this.calculateIdleModeInterval(authId, nonTerminalCount, ruleResults);
        break;

      case 'active':
        // Active mode: Rules executed recently (current poll or last hour)
        baseIntervalMinutes = this.calculateActiveModeInterval(
          authId,
          minRuleInterval,
          nonTerminalCount,
          ruleResults
        );
        break;
    }

    // Enforce minimum interval constraint
    baseIntervalMinutes = this.applyMinimumIntervalConstraint(baseIntervalMinutes);

    // Convert to milliseconds and add stagger offset if provided
    const baseIntervalMs = baseIntervalMinutes * 60 * 1000;
    let staggerOffset = 0;
    if (calculateStaggerOffset) {
      staggerOffset = calculateStaggerOffset(authId, baseIntervalMinutes);
    }

    return new Date(now + baseIntervalMs + staggerOffset);
  }
}

export default PollingIntervalCalculator;
