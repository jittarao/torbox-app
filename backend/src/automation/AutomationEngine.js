import RuleEvaluator from './RuleEvaluator.js';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import { applyIntervalMultiplier } from '../utils/intervalUtils.js';
import StateDiffEngine from './StateDiffEngine.js';
import DerivedFieldsEngine from './DerivedFieldsEngine.js';

// Import helpers
import DatabaseRetryHelper from './helpers/DatabaseRetryHelper.js';
import RuleRepository from './helpers/RuleRepository.js';
import RuleValidator from './helpers/RuleValidator.js';
import RuleExecutor from './helpers/RuleExecutor.js';
import RuleFilter from './helpers/RuleFilter.js';
import RuleMigrationHelper from './helpers/RuleMigrationHelper.js';
import {
  INITIAL_POLL_INTERVAL_MINUTES,
  DEFAULT_RETRY_MAX_RETRIES,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  MANUAL_EXECUTION_RATE_LIMIT_MS,
} from './helpers/constants.js';

/**
 * Per-user Automation Engine
 * Evaluates and executes automation rules for a single user
 */
class AutomationEngine {
  constructor(authId, encryptedApiKey, userDatabaseManager, masterDb = null) {
    this.authId = authId;
    this.encryptedApiKey = encryptedApiKey;
    this.userDatabaseManager = userDatabaseManager;
    this.masterDb = masterDb;
    this.apiKey = decrypt(encryptedApiKey);
    this.apiClient = new ApiClient(this.apiKey);
    this._ruleEvaluatorCache = null; // Cached RuleEvaluator instance
    this._ruleEvaluatorDbConnection = null; // Track the DB connection used by cached evaluator
    this.runningJobs = new Map();
    this.isInitialized = false;

    // Initialize helpers
    this.ruleRepository = new RuleRepository(authId, () => this.getUserDb());
    this.ruleValidator = new RuleValidator(authId, (rule) => this.migrateRuleToGroups(rule));
    this.ruleExecutor = new RuleExecutor(authId, () => this.getRuleEvaluator());
    this.ruleFilter = new RuleFilter(authId, () => this.getUserDb());
  }

  /**
   * Get a fresh database connection from the manager
   * This ensures we always have a valid connection even if the pool closed it
   * Includes retry logic for transient database errors
   */
  async getUserDb() {
    return await DatabaseRetryHelper.retryWithBackoff(
      async () => {
        const userDb = await this.userDatabaseManager.getUserDatabase(this.authId);
        return userDb.db;
      },
      {
        maxRetries: DEFAULT_RETRY_MAX_RETRIES,
        initialDelayMs: DEFAULT_RETRY_INITIAL_DELAY_MS,
        context: { authId: this.authId },
      }
    );
  }

  /**
   * Invalidate cached RuleEvaluator (e.g., after database errors)
   */
  invalidateRuleEvaluatorCache() {
    this._ruleEvaluatorCache = null;
    this._ruleEvaluatorDbConnection = null;
    logger.debug('RuleEvaluator cache invalidated', { authId: this.authId });
  }

  /**
   * Get RuleEvaluator with a fresh database connection
   * Caches the instance but refreshes DB connection when needed
   */
  async getRuleEvaluator() {
    // Get a fresh database connection
    const userDb = await this.getUserDb();

    // Check if we have a cached evaluator and if the DB connection is still valid
    if (this._ruleEvaluatorCache && this._ruleEvaluatorDbConnection === userDb) {
      // Same DB connection, reuse cached evaluator
      return this._ruleEvaluatorCache;
    }

    // Create new evaluator with fresh connection
    const evaluator = new RuleEvaluator(userDb, this.apiClient);

    // Cache the evaluator and track the DB connection
    this._ruleEvaluatorCache = evaluator;
    this._ruleEvaluatorDbConnection = userDb;

    logger.debug('RuleEvaluator created/cached', { authId: this.authId });
    return evaluator;
  }

  async initialize() {
    try {
      logger.info('AutomationEngine initializing', { authId: this.authId });

      // Initialize rule evaluator
      await this.getRuleEvaluator();

      // Load enabled rules from user database
      const enabledRules = await this.getAutomationRules({ enabled: true });

      // Start all enabled rules
      for (const rule of enabledRules) {
        await this.startRule(rule);
      }

      // Sync active rules flag to master DB
      await this.syncActiveRulesFlag();

      // Initialize next_poll_at if needed
      await this.initializeNextPollAt(enabledRules);

      // Get total rule count for logging
      const allRules = await this.getAutomationRules();

      this.isInitialized = true;
      logger.info('AutomationEngine initialized', {
        authId: this.authId,
        totalRules: allRules.length,
        enabledRules: enabledRules.length,
      });
    } catch (error) {
      logger.error('AutomationEngine failed to initialize', error, {
        authId: this.authId,
      });
      throw error;
    }
  }

  /**
   * Initialize next_poll_at if user has enabled rules but next_poll_at is invalid
   * @param {Array} enabledRules - Array of enabled rules
   */
  async initializeNextPollAt(enabledRules) {
    if (enabledRules.length === 0 || !this.masterDb) {
      logger.info('Skipping next_poll_at initialization check', {
        authId: this.authId,
        hasEnabledRules: enabledRules.length > 0,
        hasMasterDb: !!this.masterDb,
      });
      return;
    }

    try {
      // Invalidate cache to get fresh data
      cache.invalidateUserRegistry(this.authId);
      const userInfo = this.masterDb.getUserRegistryInfo(this.authId);

      logger.info('Checking next_poll_at during initialization', {
        authId: this.authId,
        hasUserInfo: !!userInfo,
        nextPollAt: userInfo?.next_poll_at,
        enabledRulesCount: enabledRules.length,
        hasActiveRules: userInfo?.has_active_rules,
      });

      if (userInfo && !this.isValidPollAt(userInfo.next_poll_at)) {
        logger.info('Resetting next_poll_at - invalid value detected', {
          authId: this.authId,
          invalidValue: userInfo.next_poll_at,
        });

        await this.resetNextPollAt();

        // Invalidate cache and verify it was set
        cache.invalidateUserRegistry(this.authId);
        const updatedUserInfo = this.masterDb.getUserRegistryInfo(this.authId);

        logger.info('Set initial next_poll_at for user with active rules', {
          authId: this.authId,
          enabledRulesCount: enabledRules.length,
          previousNextPollAt: userInfo.next_poll_at,
          newNextPollAt: updatedUserInfo?.next_poll_at,
          verificationSuccess: !!updatedUserInfo?.next_poll_at,
        });
      } else if (userInfo) {
        logger.info('next_poll_at is already valid, skipping reset', {
          authId: this.authId,
          nextPollAt: userInfo.next_poll_at,
        });
      } else {
        logger.warn('User info not found when checking next_poll_at', {
          authId: this.authId,
        });
      }
    } catch (error) {
      logger.error('Failed to set initial next_poll_at', error, {
        authId: this.authId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      // Don't throw - this is not critical for initialization
    }
  }

  /**
   * Check if a poll timestamp is valid
   * @param {string|null} dateStr - Date string to validate
   * @returns {boolean} - True if valid
   */
  isValidPollAt(dateStr) {
    if (!dateStr || dateStr === '' || dateStr === '0' || dateStr === '0000-00-00 00:00:00') {
      return false;
    }
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date.getTime() > 0;
  }

  /**
   * Migrate old flat conditions structure to new group structure
   * @param {Object} rule - Rule to migrate
   * @returns {Object} - Migrated rule
   */
  migrateRuleToGroups(rule) {
    return RuleMigrationHelper.migrateRuleToGroups(rule);
  }

  /**
   * Get automation rules from user database
   * Always returns rules in the new group structure format
   * @param {Object} options - Optional filter options
   * @param {boolean} options.enabled - If true, only fetch enabled rules. If false, only fetch disabled rules. If undefined, fetch all rules.
   * @returns {Promise<Array>} - Array of automation rules
   */
  async getAutomationRules(options = {}) {
    const rules = await this.ruleRepository.getRules(options);
    return rules.map((rule) => this.migrateRuleToGroups(rule));
  }

  /**
   * Check if user has any enabled automation rules
   * @returns {Promise<boolean>} - True if at least one rule is enabled
   */
  async hasActiveRules() {
    // Check cache first
    const cached = cache.getActiveRules(this.authId);
    if (cached !== undefined) {
      return cached;
    }

    // Query database if not cached
    const hasActive = await this.ruleRepository.hasActiveRules();

    // Cache the result
    cache.setActiveRules(this.authId, hasActive);
    return hasActive;
  }

  /**
   * Check if any rules have executed recently (within specified hours)
   * Used to determine if user is in "active" or "idle" mode for adaptive polling
   * @param {number} hours - Number of hours to look back (default: 1)
   * @returns {Promise<boolean>} - True if any enabled rule executed recently
   */
  async hasRecentRuleExecutions(hours = 1) {
    return await this.ruleRepository.hasRecentRuleExecutions(hours);
  }

  /**
   * Get minimum interval from all enabled rules with interval triggers
   * @returns {Promise<number|null>} - Minimum interval in minutes, or null if no interval triggers
   */
  async getMinimumRuleInterval() {
    const enabledRules = await this.getAutomationRules({ enabled: true });

    let minInterval = null;
    for (const rule of enabledRules) {
      if (rule.trigger && rule.trigger.type === 'interval' && rule.trigger.value) {
        const interval = rule.trigger.value;
        if (minInterval === null || interval < minInterval) {
          minInterval = interval;
        }
      }
    }

    return minInterval;
  }

  /**
   * Update active rules flag in master database
   * @param {boolean} hasActiveRules - Whether user has active rules
   */
  async updateMasterDbActiveRulesFlag(hasActiveRules) {
    if (!this.masterDb) {
      logger.warn('Master DB not available, cannot update active rules flag', {
        authId: this.authId,
      });
      return;
    }
    try {
      this.masterDb.updateActiveRulesFlag(this.authId, hasActiveRules);
      logger.info('Updated active rules flag in master DB', {
        authId: this.authId,
        hasActiveRules,
      });
    } catch (error) {
      logger.error('Failed to update active rules flag in master DB', error, {
        authId: this.authId,
        hasActiveRules,
      });
    }
  }

  /**
   * Sync active rules flag to master database
   */
  async syncActiveRulesFlag() {
    // Invalidate cache to ensure we get fresh data
    cache.invalidateActiveRules(this.authId);

    const hasActive = await this.hasActiveRules();
    logger.info('Syncing active rules flag to master DB', {
      authId: this.authId,
      hasActiveRules: hasActive,
      timestamp: new Date().toISOString(),
    });
    await this.updateMasterDbActiveRulesFlag(hasActive);
    logger.debug('Active rules flag synced successfully', {
      authId: this.authId,
      hasActiveRules: hasActive,
    });
  }

  /**
   * Reset next poll timestamp to 5 minutes from now (when rules change)
   * In development, uses reduced interval based on DEV_INTERVAL_MULTIPLIER
   */
  async resetNextPollAt() {
    if (!this.masterDb) {
      logger.warn('Cannot reset next_poll_at - master DB not available', {
        authId: this.authId,
      });
      return;
    }
    try {
      const adjustedIntervalMinutes = applyIntervalMultiplier(INITIAL_POLL_INTERVAL_MINUTES);
      const nextPollAt = new Date(Date.now() + adjustedIntervalMinutes * 60 * 1000);
      this.masterDb.updateNextPollAt(this.authId, nextPollAt, 0); // Count will be updated on next poll

      logger.info('Reset next_poll_at', {
        authId: this.authId,
        baseInterval: `${INITIAL_POLL_INTERVAL_MINUTES}min`,
        adjustedInterval:
          adjustedIntervalMinutes !== INITIAL_POLL_INTERVAL_MINUTES
            ? `${adjustedIntervalMinutes.toFixed(2)}min`
            : undefined,
        nextPollAt: nextPollAt.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to reset next poll timestamp', error, {
        authId: this.authId,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Start a rule (for cron-based triggers)
   */
  async startRule(rule) {
    try {
      // Stop existing job if it exists
      if (this.runningJobs.has(rule.id)) {
        this.stopRule(rule.id);
      }

      // For now, rules are evaluated on each poll cycle
      // Cron-based triggers can be added later if needed
      // This method is kept for compatibility

      logger.debug('Rule ready', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
      });
    } catch (error) {
      logger.error('Failed to start rule', error, {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
      });
    }
  }

  stopRule(ruleId) {
    if (this.runningJobs.has(ruleId)) {
      this.runningJobs.delete(ruleId);
      logger.debug('Rule stopped', {
        authId: this.authId,
        ruleId,
      });
    }
  }

  /**
   * Evaluate and execute rules (called after each poll)
   * @param {Array} torrents - Current torrents from API
   */
  async evaluateRules(torrents) {
    const evaluationStartTime = Date.now();
    try {
      logger.info('Starting rule evaluation', {
        authId: this.authId,
        torrentCount: torrents.length,
        timestamp: new Date().toISOString(),
      });

      const enabledRules = await this.getAutomationRules({ enabled: true });
      const allRules = await this.getAutomationRules();

      logger.debug('Rules loaded', {
        authId: this.authId,
        totalRules: allRules.length,
        enabledRules: enabledRules.length,
        disabledRules: allRules.length - enabledRules.length,
      });

      if (enabledRules.length === 0) {
        logger.debug('No enabled rules to evaluate', {
          authId: this.authId,
          totalRules: allRules.length,
        });
        return { evaluated: 0, executed: 0 };
      }

      logger.info('Evaluating automation rules', {
        authId: this.authId,
        enabledRuleCount: enabledRules.length,
        torrentCount: torrents.length,
        ruleNames: enabledRules.map((r) => r.name),
        ruleIds: enabledRules.map((r) => r.id),
        ruleTriggers: enabledRules.map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
        })),
      });

      const results = await this.evaluateRulesBatch(enabledRules, torrents);
      const evaluationDuration = ((Date.now() - evaluationStartTime) / 1000).toFixed(2);

      logger.info('Rule evaluation cycle completed', {
        authId: this.authId,
        totalRules: enabledRules.length,
        executedCount: results.executedCount,
        skippedCount: results.skippedCount,
        errorCount: results.errorCount,
        evaluationDuration: `${evaluationDuration}s`,
        averageRuleDuration:
          enabledRules.length > 0
            ? `${(evaluationDuration / enabledRules.length).toFixed(2)}s`
            : '0s',
      });

      return {
        evaluated: enabledRules.length,
        executed: results.executedCount,
        skipped: results.skippedCount,
        errors: results.errorCount,
      };
    } catch (error) {
      const evaluationDuration = ((Date.now() - evaluationStartTime) / 1000).toFixed(2);
      logger.error('Failed to evaluate rules', error, {
        authId: this.authId,
        evaluationDuration: `${evaluationDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      return { evaluated: 0, executed: 0, error: error.message };
    }
  }

  /**
   * Evaluate a batch of rules
   * @param {Array} enabledRules - Rules to evaluate
   * @param {Array} torrents - Torrents to evaluate against
   * @returns {Promise<Object>} - { executedCount, skippedCount, errorCount }
   */
  async evaluateRulesBatch(enabledRules, torrents) {
    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const rule of enabledRules) {
      try {
        const result = await this.evaluateSingleRule(rule, torrents);
        if (result.executed) {
          executedCount++;
        } else if (result.skipped) {
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        await this.handleRuleEvaluationError(rule, error);
      }
    }

    return { executedCount, skippedCount, errorCount };
  }

  /**
   * Evaluate a single rule
   * @param {Object} rule - Rule to evaluate
   * @param {Array} torrents - Torrents to evaluate against
   * @returns {Promise<Object>} - { executed: boolean, skipped: boolean }
   */
  async evaluateSingleRule(rule, torrents) {
    // Check if rule has an action configured
    if (!rule.action || !rule.action.type) {
      logger.warn('Rule has no action configured, skipping execution', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        hasAction: !!rule.action,
        actionType: rule.action?.type || 'none',
      });
      await this.ruleRepository.updateLastEvaluatedAt(rule.id);
      return { executed: false, skipped: true };
    }

    logger.debug('Starting rule evaluation', {
      authId: this.authId,
      ruleId: rule.id,
      ruleName: rule.name,
      trigger: rule.trigger,
      lastEvaluatedAt: rule.last_evaluated_at,
      lastExecutedAt: rule.last_executed_at,
      executionCount: rule.execution_count,
      torrentCount: torrents.length,
    });

    const ruleEvaluator = await this.getRuleEvaluator();

    // Check if rule should be evaluated based on interval
    if (this.shouldSkipRuleEvaluation(rule)) {
      logger.debug('Rule evaluation skipped - interval not elapsed', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        intervalMinutes: rule.trigger.value,
        lastEvaluatedAt: rule.last_evaluated_at,
      });
      return { executed: false, skipped: true };
    }

    // Evaluate rule
    const matchingTorrents = await ruleEvaluator.evaluateRule(rule, torrents);
    await this.ruleRepository.updateLastEvaluatedAt(rule.id);

    if (matchingTorrents.length === 0) {
      logger.info('Rule did not match any torrents', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: rule.trigger,
        torrentCount: torrents.length,
        lastEvaluatedAt: rule.last_evaluated_at,
        reason: 'No torrents matched rule conditions',
      });
      return { executed: false, skipped: true };
    }

    logger.info('Rule matched torrents', {
      authId: this.authId,
      ruleId: rule.id,
      ruleName: rule.name,
      matchedCount: matchingTorrents.length,
      matchedIds: matchingTorrents.map((t) => t.id),
    });

    // Filter torrents based on action type
    const torrentsToProcess = await this.ruleFilter.filterTorrents(matchingTorrents, rule.action);

    if (torrentsToProcess.length === 0) {
      logger.info('No torrents to process after filtering', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        matchedCount: matchingTorrents.length,
        actionType: rule.action?.type,
        reason:
          'All matching torrents were filtered out (action already applied or not applicable)',
      });
      return { executed: false, skipped: true };
    }

    // Execute actions
    const { successCount, errorCount } = await this.ruleExecutor.executeActions(
      rule,
      torrentsToProcess
    );

    // Only update execution status and log if actions were actually executed
    if (successCount > 0) {
      // Update rule execution status - only update if actions actually ran
      await this.ruleRepository.updateExecutionStatus(rule.id);

      // Log execution - use successCount to only count items where action was actually executed
      await this.ruleRepository.logExecution(
        rule.id,
        rule.name,
        'execution',
        successCount, // Only count successful executions
        errorCount === 0,
        errorCount > 0 ? `${errorCount} actions failed` : null
      );
    } else {
      // No actions were executed, but we still evaluated the rule
      // Don't update last_executed_at or create a log entry
      logger.info('No actions executed (all failed or filtered out)', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        matchedCount: matchingTorrents.length,
        processedCount: torrentsToProcess.length,
        successCount,
        errorCount,
      });
    }

    logger.info('Rule execution completed', {
      authId: this.authId,
      ruleId: rule.id,
      ruleName: rule.name,
      matchedCount: matchingTorrents.length,
      processedCount: torrentsToProcess.length,
      skippedCount: matchingTorrents.length - torrentsToProcess.length,
      successCount,
      errorCount,
      totalActions: torrentsToProcess.length,
    });

    return { executed: true, skipped: false };
  }

  /**
   * Manually run a single rule (bypasses interval checks)
   * @param {number} ruleId - ID of the rule to run
   * @returns {Promise<Object>} - Detailed execution results
   */
  async runRuleManually(ruleId) {
    const executionStartTime = Date.now();
    try {
      logger.info('Manual rule execution started', {
        authId: this.authId,
        ruleId,
        timestamp: new Date().toISOString(),
      });

      // Get the rule first to check rate limiting before expensive operations
      const allRules = await this.getAutomationRules();
      const rule = allRules.find((r) => r.id === ruleId);

      if (!rule) {
        throw new Error(`Rule with ID ${ruleId} not found`);
      }

      // Rate limiting: Check if rule was evaluated recently (before expensive operations)
      // We check last_evaluated_at because manual execution triggers evaluation regardless of actions
      if (rule.last_evaluated_at) {
        // SQLite returns dates as "YYYY-MM-DD HH:MM:SS" in UTC (without timezone indicator)
        // JavaScript's Date constructor interprets strings without timezone as local time
        // We need to explicitly parse it as UTC by converting to ISO format with 'Z' suffix
        let lastEvaluated;
        if (typeof rule.last_evaluated_at === 'string') {
          if (rule.last_evaluated_at.includes('T')) {
            // Already in ISO format, ensure it has 'Z' for UTC
            lastEvaluated = new Date(
              rule.last_evaluated_at.endsWith('Z')
                ? rule.last_evaluated_at
                : `${rule.last_evaluated_at}Z`
            );
          } else {
            // SQLite format "YYYY-MM-DD HH:MM:SS" - convert to ISO "YYYY-MM-DDTHH:MM:SSZ"
            lastEvaluated = new Date(`${rule.last_evaluated_at.replace(' ', 'T')}Z`);
          }
        } else {
          lastEvaluated = new Date(rule.last_evaluated_at);
        }

        const now = new Date();
        const timeSinceLastEvaluation = now.getTime() - lastEvaluated.getTime();

        if (timeSinceLastEvaluation < MANUAL_EXECUTION_RATE_LIMIT_MS) {
          const remainingSeconds = Math.ceil(
            (MANUAL_EXECUTION_RATE_LIMIT_MS - timeSinceLastEvaluation) / 1000
          );
          const rateLimitMinutes = MANUAL_EXECUTION_RATE_LIMIT_MS / 60000;

          logger.warn('Manual rule execution rate limited', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            lastEvaluatedAt: rule.last_evaluated_at,
            timeSinceLastEvaluation: `${Math.floor(timeSinceLastEvaluation / 1000)}s`,
            remainingSeconds,
            rateLimitMinutes,
          });

          return {
            ruleId: rule.id,
            ruleName: rule.name,
            totalTorrents: 0,
            matchedTorrents: 0,
            processedTorrents: 0,
            successCount: 0,
            errorCount: 0,
            executed: false,
            skipped: true,
            rateLimited: true,
            reason: `Rule was evaluated ${Math.floor(timeSinceLastEvaluation / 1000)} seconds ago. Please wait ${remainingSeconds} more seconds before running manually again.`,
            lastEvaluatedAt: rule.last_evaluated_at,
            rateLimitMinutes,
            executionTime: ((Date.now() - executionStartTime) / 1000).toFixed(2),
          };
        }
      }

      // Update last_evaluated_at IMMEDIATELY after rate limit check passes
      // This acts as a lock to prevent concurrent manual executions
      // We update it before expensive operations so subsequent requests are rate limited
      await this.ruleRepository.updateLastEvaluatedAt(rule.id);

      // Fetch current torrents (only if rate limit check passed)
      const torrents = await this.apiClient.getTorrents(true);
      logger.debug('Torrents fetched for manual execution', {
        authId: this.authId,
        ruleId,
        torrentCount: torrents.length,
      });

      // Process state changes and update shadow/telemetry before evaluating rule
      // This ensures we're working with fresh data, not stale shadow/telemetry
      const userDb = await this.getUserDb();
      const stateDiffEngine = new StateDiffEngine(userDb);
      const derivedFieldsEngine = new DerivedFieldsEngine(userDb);

      logger.debug('Processing state changes for manual rule execution', {
        authId: this.authId,
        ruleId,
      });

      const changes = await stateDiffEngine.processSnapshot(torrents);
      await derivedFieldsEngine.updateDerivedFields(changes);

      logger.debug('State changes processed for manual rule execution', {
        authId: this.authId,
        ruleId,
        new: changes.new.length,
        updated: changes.updated.length,
        removed: changes.removed.length,
        stateTransitions: changes.stateTransitions.length,
      });

      logger.info('Running rule manually', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        torrentCount: torrents.length,
        lastEvaluatedAt: rule.last_evaluated_at,
      });

      // Check if rule has an action configured
      if (!rule.action || !rule.action.type) {
        const result = {
          ruleId: rule.id,
          ruleName: rule.name,
          totalTorrents: torrents.length,
          matchedTorrents: 0,
          processedTorrents: 0,
          successCount: 0,
          errorCount: 0,
          executed: false,
          skipped: true,
          reason: 'Rule has no action configured',
          executionTime: ((Date.now() - executionStartTime) / 1000).toFixed(2),
        };
        logger.warn('Rule has no action configured', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
        });
        return result;
      }

      const ruleEvaluator = await this.getRuleEvaluator();

      // Evaluate rule (bypass interval check for manual execution)
      const matchingTorrents = await ruleEvaluator.evaluateRule(rule, torrents);

      if (matchingTorrents.length === 0) {
        const result = {
          ruleId: rule.id,
          ruleName: rule.name,
          totalTorrents: torrents.length,
          matchedTorrents: 0,
          processedTorrents: 0,
          successCount: 0,
          errorCount: 0,
          executed: false,
          skipped: true,
          reason: 'No torrents matched rule conditions',
          executionTime: ((Date.now() - executionStartTime) / 1000).toFixed(2),
        };
        logger.info('Rule did not match any torrents', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          torrentCount: torrents.length,
        });
        return result;
      }

      logger.info('Rule matched torrents', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        matchedCount: matchingTorrents.length,
        matchedIds: matchingTorrents.map((t) => t.id),
      });

      // Filter torrents based on action type
      const torrentsToProcess = await this.ruleFilter.filterTorrents(matchingTorrents, rule.action);

      if (torrentsToProcess.length === 0) {
        const result = {
          ruleId: rule.id,
          ruleName: rule.name,
          totalTorrents: torrents.length,
          matchedTorrents: matchingTorrents.length,
          processedTorrents: 0,
          successCount: 0,
          errorCount: 0,
          executed: false,
          skipped: true,
          reason:
            'All matching torrents were filtered out (action already applied or not applicable)',
          executionTime: ((Date.now() - executionStartTime) / 1000).toFixed(2),
        };
        logger.info('No torrents to process after filtering', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          matchedCount: matchingTorrents.length,
          actionType: rule.action?.type,
        });
        return result;
      }

      // Execute actions
      const { successCount, errorCount } = await this.ruleExecutor.executeActions(
        rule,
        torrentsToProcess
      );

      // Only update execution status and log if actions were actually executed
      if (successCount > 0) {
        // Update rule execution status - only update if actions actually ran
        await this.ruleRepository.updateExecutionStatus(rule.id);

        // Log execution - use successCount to only count items where action was actually executed
        await this.ruleRepository.logExecution(
          rule.id,
          rule.name,
          'execution',
          successCount, // Only count successful executions
          errorCount === 0,
          errorCount > 0 ? `${errorCount} actions failed` : null
        );
      } else {
        // No actions were executed, but we still evaluated the rule
        // Don't update last_executed_at or create a log entry
        logger.info('No actions executed (all failed or filtered out)', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          matchedCount: matchingTorrents.length,
          processedCount: torrentsToProcess.length,
          successCount,
          errorCount,
        });
      }

      const executionTime = ((Date.now() - executionStartTime) / 1000).toFixed(2);

      logger.info('Manual rule execution completed', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        matchedCount: matchingTorrents.length,
        processedCount: torrentsToProcess.length,
        successCount,
        errorCount,
        executionTime: `${executionTime}s`,
      });

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        totalTorrents: torrents.length,
        matchedTorrents: matchingTorrents.length,
        processedTorrents: torrentsToProcess.length,
        successCount,
        errorCount,
        executed: true,
        skipped: false,
        executionTime,
      };
    } catch (error) {
      const executionTime = ((Date.now() - executionStartTime) / 1000).toFixed(2);
      logger.error('Manual rule execution failed', error, {
        authId: this.authId,
        ruleId,
        executionTime: `${executionTime}s`,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      // Try to get rule name for error response
      let ruleName = 'Unknown';
      try {
        const allRules = await this.getAutomationRules();
        const rule = allRules.find((r) => r.id === ruleId);
        if (rule) {
          ruleName = rule.name;
        }
      } catch (nameError) {
        // Ignore error getting rule name
      }

      return {
        ruleId,
        ruleName,
        totalTorrents: 0,
        matchedTorrents: 0,
        processedTorrents: 0,
        successCount: 0,
        errorCount: 0,
        executed: false,
        skipped: false,
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Check if rule evaluation should be skipped due to interval
   * @param {Object} rule - Rule to check
   * @returns {boolean} - True if should skip
   */
  shouldSkipRuleEvaluation(rule) {
    if (
      !rule.trigger ||
      rule.trigger.type !== 'interval' ||
      !rule.trigger.value ||
      !rule.last_evaluated_at
    ) {
      return false;
    }

    const intervalMinutes = rule.trigger.value;
    const adjustedIntervalMinutes = applyIntervalMultiplier(Math.max(intervalMinutes, 1));
    const lastEvaluated = new Date(rule.last_evaluated_at);
    const intervalMs = adjustedIntervalMinutes * 60 * 1000;
    const timeSinceLastEvaluation = Date.now() - lastEvaluated.getTime();

    if (timeSinceLastEvaluation < intervalMs) {
      const remainingMs = intervalMs - timeSinceLastEvaluation;
      const remainingMinutes = (remainingMs / (60 * 1000)).toFixed(2);
      logger.debug('Rule evaluation skipped - interval not elapsed', {
        authId: this.authId,
        ruleId: rule.id,
        ruleName: rule.name,
        intervalMinutes,
        adjustedIntervalMinutes:
          adjustedIntervalMinutes !== intervalMinutes
            ? adjustedIntervalMinutes.toFixed(3)
            : undefined,
        lastEvaluatedAt: rule.last_evaluated_at,
        timeSinceLastEvaluation: `${(timeSinceLastEvaluation / (60 * 1000)).toFixed(2)} minutes`,
        remainingMinutes: `${remainingMinutes} minutes`,
      });
      return true;
    }

    return false;
  }

  /**
   * Handle rule evaluation error
   * @param {Object} rule - Rule that failed
   * @param {Error} error - Error that occurred
   */
  async handleRuleEvaluationError(rule, error) {
    logger.error('Rule evaluation failed', error, {
      authId: this.authId,
      ruleId: rule.id,
      ruleName: rule.name,
      errorMessage: error.message,
      errorStack: error.stack,
    });

    // Invalidate cache on database errors
    if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
      this.invalidateRuleEvaluatorCache();
    }

    // Update last_evaluated_at even on error (we attempt to check it)
    try {
      await this.ruleRepository.updateLastEvaluatedAt(rule.id);
    } catch (updateError) {
      logger.debug('Failed to update last_evaluated_at on error (non-critical)', {
        authId: this.authId,
        ruleId: rule.id,
        errorMessage: updateError.message,
      });
      // Invalidate cache on database errors
      if (updateError.message?.includes('SQLITE') || updateError.message?.includes('database')) {
        this.invalidateRuleEvaluatorCache();
      }
    }
    await this.ruleRepository.logExecution(
      rule.id,
      rule.name,
      'execution',
      0,
      false,
      error.message
    );
  }

  /**
   * Validate a single rule configuration
   * @param {Object} rule - Rule to validate
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateRule(rule) {
    return this.ruleValidator.validate(rule);
  }

  /**
   * Save automation rules
   * @returns {Promise<Array>} - Array of saved rules with database-assigned IDs
   */
  async saveAutomationRules(rules) {
    // Validate all rules before saving
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const validation = this.validateRule(rule);

      if (!validation.valid) {
        const errorMessage = `Rule ${i + 1}${rule.name ? ` (${rule.name})` : ''} validation failed: ${validation.errors.join('; ')}`;
        logger.warn('Rule validation failed', {
          authId: this.authId,
          ruleIndex: i,
          ruleName: rule.name,
          errors: validation.errors,
        });
        throw new Error(errorMessage);
      }
    }

    // Save rules and get back the saved rules with database-assigned IDs
    const savedRules = await this.ruleRepository.saveRules(rules);

    // Update master DB flag and reset polling
    const hasActive = rules.some((r) => r.enabled);
    await this.updateMasterDbActiveRulesFlag(hasActive);

    // Invalidate cache since rules changed
    cache.invalidateActiveRules(this.authId);

    if (hasActive) {
      await this.resetNextPollAt();
    }

    return savedRules;
  }

  /**
   * Update rule status
   */
  async updateRuleStatus(ruleId, enabled) {
    await this.ruleRepository.updateRuleStatus(ruleId, enabled);

    // Invalidate cache since rule status changed
    cache.invalidateActiveRules(this.authId);

    // Update master DB flag and reset polling if enabling
    await this.syncActiveRulesFlag();
    if (enabled) {
      await this.resetNextPollAt();
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId) {
    await this.ruleRepository.deleteRule(ruleId);

    // Invalidate cache since rule was deleted
    cache.invalidateActiveRules(this.authId);

    // Update master DB flag
    await this.syncActiveRulesFlag();
  }

  /**
   * Get rule execution history
   */
  async getRuleExecutionHistory(ruleId = null, limit = 100) {
    return await this.ruleRepository.getExecutionHistory(ruleId, limit);
  }

  /**
   * Clear rule execution history
   */
  async clearRuleExecutionHistory(ruleId = null) {
    await this.ruleRepository.clearExecutionHistory(ruleId);
  }

  async reloadRules() {
    try {
      logger.info('Reloading rules', { authId: this.authId });

      // Stop all existing jobs
      this.runningJobs.clear();

      // Reload enabled rules from database
      const enabledRules = await this.getAutomationRules({ enabled: true });

      // Start enabled rules
      for (const rule of enabledRules) {
        await this.startRule(rule);
      }

      // Get total rule count for logging
      const allRules = await this.getAutomationRules();

      logger.info('Rules reloaded', {
        authId: this.authId,
        totalRules: allRules.length,
        enabledRules: enabledRules.length,
      });
    } catch (error) {
      logger.error('Failed to reload rules', error, { authId: this.authId });
    }
  }

  getStatus() {
    return {
      authId: this.authId,
      initialized: this.isInitialized,
      runningJobs: this.runningJobs.size,
    };
  }

  shutdown() {
    logger.info('AutomationEngine shutting down', { authId: this.authId });
    this.runningJobs.clear();
  }
}

export default AutomationEngine;
