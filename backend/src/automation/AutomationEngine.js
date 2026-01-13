import RuleEvaluator from './RuleEvaluator.js';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import { applyIntervalMultiplier } from '../utils/intervalUtils.js';

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
    // RuleEvaluator will get database from getUserDb() when needed
    this.ruleEvaluator = null;
    this._ruleEvaluatorCache = null; // Cached RuleEvaluator instance
    this._ruleEvaluatorDbConnection = null; // Track the DB connection used by cached evaluator
    this.runningJobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @param {number} initialDelayMs - Initial delay in milliseconds (default: 100)
   * @returns {Promise} - Result of the function
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelayMs = 100) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Check if error is transient (SQLite busy, connection errors)
        const isTransient = error.message?.includes('SQLITE_BUSY') ||
                           error.message?.includes('database is locked') ||
                           error.message?.includes('connection') ||
                           error.code === 'SQLITE_BUSY' ||
                           error.code === 'SQLITE_LOCKED';
        
        if (!isTransient || attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        logger.warn('Database operation failed, retrying', {
          authId: this.authId,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          errorMessage: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  /**
   * Get a fresh database connection from the manager
   * This ensures we always have a valid connection even if the pool closed it
   * Includes retry logic for transient database errors
   */
  async getUserDb() {
    return await this.retryWithBackoff(async () => {
      const userDb = await this.userDatabaseManager.getUserDatabase(this.authId);
      return userDb.db;
    });
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
      
      // If user has enabled rules but next_poll_at is NULL/empty/0, set initial poll time
      // This ensures users with active rules get polled on startup
      if (enabledRules.length > 0 && this.masterDb) {
        try {
          // Invalidate cache to get fresh data
          cache.invalidateUserRegistry(this.authId);
          const userInfo = this.masterDb.getUserRegistryInfo(this.authId);
          
          logger.info('Checking next_poll_at during initialization', {
            authId: this.authId,
            hasUserInfo: !!userInfo,
            nextPollAt: userInfo?.next_poll_at,
            enabledRulesCount: enabledRules.length,
            hasActiveRules: userInfo?.has_active_rules
          });
          
          if (userInfo) {
            // Check if next_poll_at is NULL, empty, '0', or invalid datetime
            const nextPollAt = userInfo.next_poll_at;
            
            // Helper to check if a date string is valid
            const isValidDate = (dateStr) => {
              if (!dateStr || dateStr === '' || dateStr === '0' || dateStr === '0000-00-00 00:00:00') {
                return false;
              }
              const date = new Date(dateStr);
              return !isNaN(date.getTime()) && date.getTime() > 0;
            };
            
            const isInvalidPollAt = !isValidDate(nextPollAt);
            
            logger.info('next_poll_at validation result', {
              authId: this.authId,
              nextPollAt,
              isInvalidPollAt,
              isValidDateResult: isValidDate(nextPollAt)
            });
            
            if (isInvalidPollAt) {
              // Set initial poll time to 5 minutes from now (adjusted in dev)
              logger.info('Resetting next_poll_at - invalid value detected', {
                authId: this.authId,
                invalidValue: nextPollAt
              });
              
              await this.resetNextPollAt();
              
              // Invalidate cache and verify it was set
              cache.invalidateUserRegistry(this.authId);
              const updatedUserInfo = this.masterDb.getUserRegistryInfo(this.authId);
              
              logger.info('Set initial next_poll_at for user with active rules', {
                authId: this.authId,
                enabledRulesCount: enabledRules.length,
                previousNextPollAt: nextPollAt,
                newNextPollAt: updatedUserInfo?.next_poll_at,
                verificationSuccess: !!updatedUserInfo?.next_poll_at
              });
            } else {
              logger.info('next_poll_at is already valid, skipping reset', {
                authId: this.authId,
                nextPollAt
              });
            }
          } else {
            logger.warn('User info not found when checking next_poll_at', {
              authId: this.authId
            });
          }
        } catch (error) {
          logger.error('Failed to set initial next_poll_at', error, {
            authId: this.authId,
            errorMessage: error.message,
            errorStack: error.stack
          });
          // Don't throw - this is not critical for initialization
        }
      } else {
        logger.info('Skipping next_poll_at initialization check', {
          authId: this.authId,
          hasEnabledRules: enabledRules.length > 0,
          hasMasterDb: !!this.masterDb
        });
      }
      
      // Get total rule count for logging
      const allRules = await this.getAutomationRules();
      
      this.isInitialized = true;
      logger.info('AutomationEngine initialized', {
        authId: this.authId,
        totalRules: allRules.length,
        enabledRules: enabledRules.length,
      });
    } catch (error) {
      logger.error('AutomationEngine failed to initialize', error, { authId: this.authId });
      throw error;
    }
  }

  /**
   * Migrate old flat conditions structure to new group structure
   * @param {Object} rule - Rule to migrate
   * @returns {Object} - Migrated rule
   */
  migrateRuleToGroups(rule) {
    // If rule already has groups structure, return as is
    if (rule.groups && Array.isArray(rule.groups) && rule.groups.length > 0) {
      return rule;
    }
    
    // If conditions is an array (old format), convert to group structure
    if (Array.isArray(rule.conditions)) {
      return {
        ...rule,
        logicOperator: rule.logicOperator || 'and',
        groups: [
          {
            logicOperator: 'and',
            conditions: rule.conditions,
          },
        ],
      };
    }
    
    // If no conditions, return with empty group structure
    return {
      ...rule,
      logicOperator: rule.logicOperator || 'and',
      groups: [
        {
          logicOperator: 'and',
          conditions: [],
        },
      ],
    };
  }

  /**
   * Get automation rules from user database
   * Always returns rules in the new group structure format
   * @param {Object} options - Optional filter options
   * @param {boolean} options.enabled - If true, only fetch enabled rules. If false, only fetch disabled rules. If undefined, fetch all rules.
   * @returns {Promise<Array>} - Array of automation rules
   */
  async getAutomationRules(options = {}) {
    const userDb = await this.getUserDb();
    let sql = 'SELECT * FROM automation_rules';
    const params = [];
    
    // Add WHERE clause for enabled filter if specified
    if (options.enabled === true) {
      sql += ' WHERE enabled = 1';
    } else if (options.enabled === false) {
      sql += ' WHERE enabled = 0';
    }
    
    sql += ' ORDER BY created_at DESC';
    const rules = userDb.prepare(sql).all(...params);
    return rules.map(rule => {
      const parsedConditions = JSON.parse(rule.conditions);
      
      // Check if conditions is actually groups structure
      const hasGroups = parsedConditions && typeof parsedConditions === 'object' && 
                       Array.isArray(parsedConditions.groups) && parsedConditions.groups.length > 0;
      
      const ruleObj = {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled === 1,
        trigger: JSON.parse(rule.trigger_config),
        action: rule.action_config ? JSON.parse(rule.action_config) : null,
        metadata: rule.metadata ? JSON.parse(rule.metadata) : null,
        last_executed_at: rule.last_executed_at,
        last_evaluated_at: rule.last_evaluated_at,
        execution_count: rule.execution_count || 0,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      };
      
      // If stored as groups structure, extract it
      if (hasGroups) {
        ruleObj.groups = parsedConditions.groups;
        ruleObj.logicOperator = parsedConditions.logicOperator || 'and';
      } else {
        // Old format - conditions is an array, migrate to groups
        ruleObj.logicOperator = 'and';
        ruleObj.groups = [
          {
            logicOperator: 'and',
            conditions: Array.isArray(parsedConditions) ? parsedConditions : [],
          },
        ];
      }
      
      // Always return in new group structure format
      return this.migrateRuleToGroups(ruleObj);
    });
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
    const userDb = await this.getUserDb();
    const result = userDb.prepare(`
      SELECT COUNT(*) as count 
      FROM automation_rules 
      WHERE enabled = 1
    `).get();
    const hasActive = result && result.count > 0;
    
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
    const userDb = await this.getUserDb();
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const result = userDb.prepare(`
      SELECT COUNT(*) as count 
      FROM automation_rules 
      WHERE enabled = 1 
        AND last_executed_at IS NOT NULL
        AND last_executed_at >= ?
    `).get(hoursAgo);
    
    return result && result.count > 0;
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
        authId: this.authId
      });
      return; // Master DB not available
    }
    try {
      this.masterDb.updateActiveRulesFlag(this.authId, hasActiveRules);
      logger.info('Updated active rules flag in master DB', {
        authId: this.authId,
        hasActiveRules
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
      timestamp: new Date().toISOString()
    });
    await this.updateMasterDbActiveRulesFlag(hasActive);
    logger.debug('Active rules flag synced successfully', {
      authId: this.authId,
      hasActiveRules: hasActive
    });
  }

  /**
   * Reset next poll timestamp to 5 minutes from now (when rules change)
   * In development, uses reduced interval based on DEV_INTERVAL_MULTIPLIER
   */
  async resetNextPollAt() {
    if (!this.masterDb) {
      logger.warn('Cannot reset next_poll_at - master DB not available', {
        authId: this.authId
      });
      return; // Master DB not available
    }
    try {
      const baseIntervalMinutes = 5;
      const adjustedIntervalMinutes = applyIntervalMultiplier(baseIntervalMinutes);
      const nextPollAt = new Date(Date.now() + adjustedIntervalMinutes * 60 * 1000);
      this.masterDb.updateNextPollAt(this.authId, nextPollAt, 0); // Count will be updated on next poll
      
      logger.info('Reset next_poll_at', {
        authId: this.authId,
        baseInterval: `${baseIntervalMinutes}min`,
        adjustedInterval: adjustedIntervalMinutes !== baseIntervalMinutes ? `${adjustedIntervalMinutes.toFixed(2)}min` : undefined,
        nextPollAt: nextPollAt.toISOString()
      });
    } catch (error) {
      logger.error('Failed to reset next poll timestamp', error, {
        authId: this.authId,
        errorMessage: error.message,
        errorStack: error.stack
      });
      throw error; // Re-throw so caller knows it failed
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
        timestamp: new Date().toISOString()
      });

      const enabledRules = await this.getAutomationRules({ enabled: true });
      
      // Get total rule count for logging
      const allRules = await this.getAutomationRules();

      logger.debug('Rules loaded', {
        authId: this.authId,
        totalRules: allRules.length,
        enabledRules: enabledRules.length,
        disabledRules: allRules.length - enabledRules.length
      });

      if (enabledRules.length === 0) {
        logger.debug('No enabled rules to evaluate', {
          authId: this.authId,
          totalRules: allRules.length
        });
        return { evaluated: 0, executed: 0 };
      }

      logger.info('Evaluating automation rules', {
        authId: this.authId,
        enabledRuleCount: enabledRules.length,
        torrentCount: torrents.length,
        ruleNames: enabledRules.map(r => r.name),
        ruleIds: enabledRules.map(r => r.id),
        ruleTriggers: enabledRules.map(r => ({ id: r.id, name: r.name, trigger: r.trigger }))
      });

      let executedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const rule of enabledRules) {
        const userDb = await this.getUserDb();
        try {
          // Check if rule has an action configured
          if (!rule.action || !rule.action.type) {
            logger.warn('Rule has no action configured, skipping execution', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              hasAction: !!rule.action,
              actionType: rule.action?.type || 'none'
            });
            skippedCount++;
            // Update last_evaluated_at even when skipped due to no action
            try {
              userDb.prepare(`
                UPDATE automation_rules 
                SET last_evaluated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(rule.id);
            } catch (error) {
              // Log but don't fail - column should exist via migration
              logger.debug('Failed to update last_evaluated_at (non-critical)', {
                authId: this.authId,
                ruleId: rule.id,
                errorMessage: error.message
              });
            }
            continue;
          }

          // Evaluate rule (this will check interval internally)
          logger.debug('Starting rule evaluation', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            trigger: rule.trigger,
            lastEvaluatedAt: rule.last_evaluated_at,
            lastExecutedAt: rule.last_executed_at,
            executionCount: rule.execution_count,
            torrentCount: torrents.length
          });
          
          const ruleEvaluator = await this.getRuleEvaluator();
          
          // Check if rule should be evaluated based on interval BEFORE calling evaluateRule
          // This way we can avoid updating last_evaluated_at if skipped
          let shouldEvaluate = true;
          if (rule.trigger && rule.trigger.type === 'interval' && rule.trigger.value && rule.last_evaluated_at) {
            const intervalMinutes = rule.trigger.value;
            // Apply development multiplier to reduce intervals for testing
            const adjustedIntervalMinutes = applyIntervalMultiplier(Math.max(intervalMinutes, 1));
            const lastEvaluated = new Date(rule.last_evaluated_at);
            const intervalMs = adjustedIntervalMinutes * 60 * 1000;
            const timeSinceLastEvaluation = Date.now() - lastEvaluated.getTime();
            
            if (timeSinceLastEvaluation < intervalMs) {
              shouldEvaluate = false;
              const remainingMs = intervalMs - timeSinceLastEvaluation;
              const remainingMinutes = (remainingMs / (60 * 1000)).toFixed(2);
              logger.debug('Rule evaluation skipped - interval not elapsed', {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                intervalMinutes,
                adjustedIntervalMinutes: adjustedIntervalMinutes !== intervalMinutes ? adjustedIntervalMinutes.toFixed(3) : undefined,
                lastEvaluatedAt: rule.last_evaluated_at,
                timeSinceLastEvaluation: `${(timeSinceLastEvaluation / (60 * 1000)).toFixed(2)} minutes`,
                remainingMinutes: `${remainingMinutes} minutes`
              });
            }
          }
          
          let matchingTorrents = [];
          if (shouldEvaluate) {
            matchingTorrents = await ruleEvaluator.evaluateRule(rule, torrents);
            
            // Update last_evaluated_at after checking rule (only if actually evaluated)
            // This tracks when the rule was last checked, not just when it executed
            try {
              userDb.prepare(`
                UPDATE automation_rules 
                SET last_evaluated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(rule.id);
            } catch (error) {
              // Log but don't fail - column should exist via migration
              logger.debug('Failed to update last_evaluated_at (non-critical)', {
                authId: this.authId,
                ruleId: rule.id,
                errorMessage: error.message
              });
            }
          } else {
            // Rule was skipped due to interval - don't update last_evaluated_at
            skippedCount++;
            continue;
          }

          if (matchingTorrents.length === 0) {
            logger.info('Rule did not match any torrents', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              trigger: rule.trigger,
              torrentCount: torrents.length,
              lastEvaluatedAt: rule.last_evaluated_at,
              reason: 'No torrents matched rule conditions'
            });
            skippedCount++;
            continue;
          }

          logger.info('Rule matched torrents', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            matchedCount: matchingTorrents.length,
            matchedIds: matchingTorrents.map(t => t.id)
          });

          // Filter torrents for add_tag action - skip torrents that already have all the tags
          let torrentsToProcess = matchingTorrents;
          if (rule.action?.type === 'add_tag' && rule.action.tagIds && rule.action.tagIds.length > 0) {
            const userDb = await this.getUserDb();
            
            // Collect all download IDs
            const allDownloadIds = matchingTorrents
              .map(t => t.id?.toString() || t.torrent_id?.toString() || t.usenet_id?.toString() || t.web_id?.toString())
              .filter(id => id);
            
            if (allDownloadIds.length > 0) {
              // Batch load tags for all matching torrents
              const placeholders = allDownloadIds.map(() => '?').join(',');
              const allDownloadTags = userDb.prepare(`
                SELECT dt.download_id, dt.tag_id
                FROM download_tags dt
                WHERE dt.download_id IN (${placeholders})
              `).all(...allDownloadIds);
              
              // Group tag IDs by download_id
              const tagsByDownloadId = new Map();
              for (const row of allDownloadTags) {
                const downloadId = String(row.download_id);
                if (!tagsByDownloadId.has(downloadId)) {
                  tagsByDownloadId.set(downloadId, new Set());
                }
                tagsByDownloadId.get(downloadId).add(row.tag_id);
              }
              
              // Filter out torrents that already have all the tags
              const targetTagIds = new Set(rule.action.tagIds);
              torrentsToProcess = matchingTorrents.filter(torrent => {
                const downloadId = torrent.id?.toString() || torrent.torrent_id?.toString() || 
                                  torrent.usenet_id?.toString() || torrent.web_id?.toString();
                if (!downloadId) {
                  return true; // Keep torrents without ID (will fail later, but let it fail explicitly)
                }
                
                const existingTagIds = tagsByDownloadId.get(downloadId) || new Set();
                
                // Check if torrent already has all the tags
                const hasAllTags = Array.from(targetTagIds).every(tagId => existingTagIds.has(tagId));
                
                if (hasAllTags) {
                  logger.debug('Skipping torrent - already has all tags', {
                    authId: this.authId,
                    ruleId: rule.id,
                    ruleName: rule.name,
                    torrentId: torrent.id,
                    torrentName: torrent.name,
                    existingTagIds: Array.from(existingTagIds),
                    targetTagIds: Array.from(targetTagIds)
                  });
                  return false;
                }
                
                return true;
              });
              
              const skippedCount = matchingTorrents.length - torrentsToProcess.length;
              if (skippedCount > 0) {
                logger.info('Filtered torrents that already have all tags', {
                  authId: this.authId,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  originalCount: matchingTorrents.length,
                  filteredCount: torrentsToProcess.length,
                  skippedCount
                });
              }
            }
          }

          // Skip execution if no torrents to process after filtering
          if (torrentsToProcess.length === 0) {
            logger.info('No torrents to process after filtering (all already have tags)', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              matchedCount: matchingTorrents.length,
              actionType: rule.action?.type
            });
            skippedCount++;
            continue;
          }

          // Execute actions
          let successCount = 0;
          let errorCount = 0;

          for (const torrent of torrentsToProcess) {
            let ruleEvaluator = null;
            try {
              ruleEvaluator = await this.getRuleEvaluator();
              logger.debug('Executing action on torrent', {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                torrentId: torrent.id,
                torrentName: torrent.name,
                action: rule.action?.type,
                torrentStatus: ruleEvaluator.getTorrentStatus(torrent)
              });
              
              await ruleEvaluator.executeAction(rule.action, torrent);
              successCount++;
              
              logger.debug('Action successfully executed', {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                torrentId: torrent.id,
                torrentName: torrent.name,
                action: rule.action?.type
              });
            } catch (error) {
              // Safely get torrent status for logging, handle errors gracefully
              let torrentStatus = 'unknown';
              try {
                if (!ruleEvaluator) {
                  ruleEvaluator = await this.getRuleEvaluator();
                }
                torrentStatus = ruleEvaluator.getTorrentStatus(torrent);
              } catch (statusError) {
                // If we can't get status, just log without it
                logger.debug('Could not get torrent status for error logging', {
                  authId: this.authId,
                  torrentId: torrent.id,
                  statusError: statusError.message
                });
              }
              
              logger.error('Action failed for torrent', error, {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                torrentId: torrent.id,
                torrentName: torrent.name,
                torrentStatus: torrentStatus,
                action: rule.action?.type
              });
              errorCount++;
            }
          }

          // Update rule execution status
          userDb.prepare(`
            UPDATE automation_rules 
            SET last_executed_at = CURRENT_TIMESTAMP,
                execution_count = execution_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(rule.id);

          // Log execution
          await this.logRuleExecution(
            rule.id,
            rule.name,
            'execution',
            torrentsToProcess.length,
            errorCount === 0,
            errorCount > 0 ? `${errorCount} actions failed` : null
          );

          executedCount++;
          
          logger.info('Rule execution completed', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            matchedCount: matchingTorrents.length,
            processedCount: torrentsToProcess.length,
            skippedCount: matchingTorrents.length - torrentsToProcess.length,
            successCount,
            errorCount,
            totalActions: torrentsToProcess.length
          });
        } catch (error) {
          errorCount++;
          logger.error('Rule evaluation failed', error, {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            errorMessage: error.message,
            errorStack: error.stack
          });
          
          // Invalidate cache on database errors
          if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
            this.invalidateRuleEvaluatorCache();
          }
          
          // Update last_evaluated_at even on error (we attempt to check it)
          try {
            const userDb = await this.getUserDb();
            userDb.prepare(`
              UPDATE automation_rules 
              SET last_evaluated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(rule.id);
          } catch (updateError) {
            // Log but don't fail - column should exist via migration
            logger.debug('Failed to update last_evaluated_at on error (non-critical)', {
              authId: this.authId,
              ruleId: rule.id,
              errorMessage: updateError.message
            });
            // Invalidate cache on database errors
            if (updateError.message?.includes('SQLITE') || updateError.message?.includes('database')) {
              this.invalidateRuleEvaluatorCache();
            }
          }
          await this.logRuleExecution(rule.id, rule.name, 'execution', 0, false, error.message);
        }
      }

      const evaluationDuration = ((Date.now() - evaluationStartTime) / 1000).toFixed(2);
      logger.info('Rule evaluation cycle completed', {
        authId: this.authId,
        totalRules: enabledRules.length,
        executedCount,
        skippedCount,
        errorCount,
        evaluationDuration: `${evaluationDuration}s`,
        averageRuleDuration: enabledRules.length > 0 
          ? `${(evaluationDuration / enabledRules.length).toFixed(2)}s` 
          : '0s'
      });

      return { 
        evaluated: enabledRules.length, 
        executed: executedCount,
        skipped: skippedCount,
        errors: errorCount
      };
    } catch (error) {
      const evaluationDuration = ((Date.now() - evaluationStartTime) / 1000).toFixed(2);
      logger.error('Failed to evaluate rules', error, {
        authId: this.authId,
        evaluationDuration: `${evaluationDuration}s`,
        errorMessage: error.message,
        errorStack: error.stack
      });
      return { evaluated: 0, executed: 0, error: error.message };
    }
  }

  /**
   * Log rule execution
   */
  async logRuleExecution(ruleId, ruleName, executionType, itemsProcessed = 0, success = true, errorMessage = null) {
    try {
      // Validate required parameters
      if (ruleId == null || ruleName == null || executionType == null) {
        logger.warn('Invalid parameters for rule execution log', {
          authId: this.authId,
          ruleId,
          ruleName,
          executionType
        });
        return;
      }

      const userDb = await this.getUserDb();
      const sql = `
        INSERT INTO rule_execution_log (rule_id, rule_name, execution_type, items_processed, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      userDb.prepare(sql).run(ruleId, ruleName, executionType, itemsProcessed, success ? 1 : 0, errorMessage);
      logger.debug('Rule execution logged successfully', {
        authId: this.authId,
        ruleId,
        ruleName,
        executionType,
        itemsProcessed,
        success
      });
    } catch (error) {
      // Log the error but don't throw - we don't want logging failures to break rule execution
      logger.error('Failed to log rule execution', error, {
        authId: this.authId,
        ruleId,
        ruleName,
        executionType,
        itemsProcessed,
        success,
        errorMessage
      });
    }
  }

  /**
   * Validate a single rule configuration
   * @param {Object} rule - Rule to validate
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateRule(rule) {
    const errors = [];

    // Validate rule name
    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim().length === 0) {
      errors.push('Rule name is required and must be a non-empty string');
    }

    // Validate enabled flag
    if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
      errors.push('Rule enabled flag must be a boolean');
    }

    // Validate trigger configuration
    const trigger = rule.trigger || rule.trigger_config;
    if (trigger) {
      if (typeof trigger !== 'object') {
        errors.push('Trigger must be an object');
      } else {
        if (trigger.type && typeof trigger.type !== 'string') {
          errors.push('Trigger type must be a string');
        }
        if (trigger.type === 'interval') {
          if (trigger.value === undefined || trigger.value === null) {
            errors.push('Interval trigger must have a value');
          } else if (typeof trigger.value !== 'number' || trigger.value < 1) {
            errors.push('Interval trigger value must be a number >= 1 (minutes)');
          }
        }
      }
    }

    // Validate action configuration
    const action = rule.action || rule.action_config;
    if (!action) {
      errors.push('Rule must have an action configuration');
    } else if (typeof action !== 'object') {
      errors.push('Action must be an object');
    } else {
      if (!action.type || typeof action.type !== 'string') {
        errors.push('Action type is required and must be a string');
      } else {
        const validActionTypes = ['stop_seeding', 'delete', 'archive', 'force_start', 'add_tag', 'remove_tag'];
        if (!validActionTypes.includes(action.type)) {
          errors.push(`Invalid action type: ${action.type}. Valid types: ${validActionTypes.join(', ')}`);
        }

        // Validate action-specific fields
        if (action.type === 'add_tag' || action.type === 'remove_tag') {
          if (!Array.isArray(action.tagIds) || action.tagIds.length === 0) {
            errors.push(`${action.type} action requires tagIds to be a non-empty array`);
          } else {
            const invalidTagIds = action.tagIds.filter(id => typeof id !== 'number' || id <= 0 || !Number.isInteger(id));
            if (invalidTagIds.length > 0) {
              errors.push(`${action.type} action tagIds must be positive integers`);
            }
          }
        }
      }
    }

    // Validate conditions/groups structure
    const migratedRule = this.migrateRuleToGroups(rule);
    const hasGroups = migratedRule.groups && Array.isArray(migratedRule.groups) && migratedRule.groups.length > 0;

    if (hasGroups) {
      // Validate logic operator
      const logicOperator = migratedRule.logicOperator || 'and';
      if (logicOperator !== 'and' && logicOperator !== 'or') {
        errors.push(`Logic operator must be 'and' or 'or', got: ${logicOperator}`);
      }

      // Validate groups structure
      if (!Array.isArray(migratedRule.groups)) {
        errors.push('Groups must be an array');
      } else {
        migratedRule.groups.forEach((group, groupIndex) => {
          if (typeof group !== 'object' || group === null) {
            errors.push(`Group ${groupIndex} must be an object`);
            return;
          }

          // Validate group logic operator
          const groupLogicOp = group.logicOperator || 'and';
          if (groupLogicOp !== 'and' && groupLogicOp !== 'or') {
            errors.push(`Group ${groupIndex} logic operator must be 'and' or 'or', got: ${groupLogicOp}`);
          }

          // Validate conditions array
          const conditions = group.conditions || [];
          if (!Array.isArray(conditions)) {
            errors.push(`Group ${groupIndex} conditions must be an array`);
          } else {
            // Warn about empty groups (but don't error - they match nothing)
            if (conditions.length === 0) {
              logger.warn('Empty group detected in rule - will match nothing', {
                authId: this.authId,
                ruleName: rule.name,
                groupIndex
              });
            }

            // Validate each condition
            conditions.forEach((condition, condIndex) => {
              if (typeof condition !== 'object' || condition === null) {
                errors.push(`Group ${groupIndex}, condition ${condIndex} must be an object`);
                return;
              }

              // Validate condition type
              if (!condition.type || typeof condition.type !== 'string') {
                errors.push(`Group ${groupIndex}, condition ${condIndex} must have a type string`);
              } else {
                const validConditionTypes = [
                  'SEEDING_TIME', 'AGE', 'LAST_DOWNLOAD_ACTIVITY_AT', 'LAST_UPLOAD_ACTIVITY_AT',
                  'PROGRESS', 'DOWNLOAD_SPEED', 'UPLOAD_SPEED', 'AVG_DOWNLOAD_SPEED', 'AVG_UPLOAD_SPEED', 'ETA',
                  'DOWNLOAD_STALLED_TIME', 'UPLOAD_STALLED_TIME',
                  'SEEDS', 'PEERS', 'RATIO', 'TOTAL_UPLOADED', 'TOTAL_DOWNLOADED',
                  'FILE_SIZE', 'FILE_COUNT', 'NAME', 'TRACKER', 'PRIVATE', 'CACHED', 'AVAILABILITY', 'ALLOW_ZIP',
                  'IS_ACTIVE', 'SEEDING_ENABLED', 'LONG_TERM_SEEDING', 'STATUS', 'EXPIRES_AT', 'TAGS'
                ];
                if (!validConditionTypes.includes(condition.type)) {
                  errors.push(`Group ${groupIndex}, condition ${condIndex} has invalid type: ${condition.type}`);
                }
              }

              // Validate operator (required for most conditions, optional for some)
              if (condition.operator !== undefined) {
                // Numeric/comparison operators
                const comparisonOperators = ['gt', 'lt', 'gte', 'lte', 'eq'];
                // Tag operators (backend format)
                const tagOperators = ['has_any', 'has_all', 'has_none'];
                // Tag operators (frontend format - will be mapped in RuleEvaluator)
                const tagOperatorsFrontend = ['is_any_of', 'is_all_of', 'is_none_of'];
                // Multi-select operators (for STATUS)
                const multiSelectOperators = ['is_any_of', 'is_none_of'];
                // String operators (for NAME, TRACKER)
                const stringOperators = ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with'];
                // Boolean operators
                const booleanOperators = ['is_true', 'is_false'];
                
                const validOperators = [
                  ...comparisonOperators,
                  ...tagOperators,
                  ...tagOperatorsFrontend,
                  ...multiSelectOperators,
                  ...stringOperators,
                  ...booleanOperators
                ];
                
                if (!validOperators.includes(condition.operator)) {
                  errors.push(`Group ${groupIndex}, condition ${condIndex} has invalid operator: ${condition.operator}`);
                }
              }

              // Validate value (required for most conditions)
              if (condition.value === undefined && condition.type !== 'NAME') {
                // NAME condition doesn't require operator, but needs value
                if (condition.type === 'NAME' && !condition.value) {
                  errors.push(`Group ${groupIndex}, condition ${condIndex} (NAME) must have a value`);
                } else if (condition.type !== 'NAME') {
                  errors.push(`Group ${groupIndex}, condition ${condIndex} must have a value`);
                }
              }

              // Type-specific validations
              if (condition.type === 'STATUS' && !Array.isArray(condition.value)) {
                errors.push(`Group ${groupIndex}, condition ${condIndex} (STATUS) value must be an array`);
              }
              if (condition.type === 'TAGS' && !Array.isArray(condition.value)) {
                errors.push(`Group ${groupIndex}, condition ${condIndex} (TAGS) value must be an array`);
              }
              if ((condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED') && 
                  condition.hours !== undefined && (typeof condition.hours !== 'number' || condition.hours <= 0)) {
                errors.push(`Group ${groupIndex}, condition ${condIndex} (${condition.type}) hours must be a positive number`);
              }
            });
          }
        });
      }
    } else {
      // Old flat structure - validate conditions array
      const conditions = rule.conditions || [];
      if (!Array.isArray(conditions)) {
        errors.push('Conditions must be an array (or use groups structure)');
      } else {
        const logicOperator = rule.logicOperator || 'and';
        if (logicOperator !== 'and' && logicOperator !== 'or') {
          errors.push(`Logic operator must be 'and' or 'or', got: ${logicOperator}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Save automation rules
   */
  async saveAutomationRules(rules) {
    const userDb = await this.getUserDb();
    
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
          errors: validation.errors
        });
        throw new Error(errorMessage);
      }
    }
    
    // Clear existing rules
    userDb.prepare('DELETE FROM automation_rules').run();
    
    // Insert new rules
    for (const rule of rules) {
      // Migrate rule to group structure if needed
      const migratedRule = this.migrateRuleToGroups(rule);
      
      // Store groups structure in conditions field
      // Format: { logicOperator: 'and'|'or', groups: [...] }
      const conditionsToStore = migratedRule.groups && Array.isArray(migratedRule.groups)
        ? {
            logicOperator: migratedRule.logicOperator || 'and',
            groups: migratedRule.groups,
          }
        : migratedRule.conditions || [];
      
      const sql = `
        INSERT INTO automation_rules (name, enabled, trigger_config, conditions, action_config, metadata, cooldown_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      userDb.prepare(sql).run(
        migratedRule.name,
        migratedRule.enabled ? 1 : 0,
        JSON.stringify(migratedRule.trigger || migratedRule.trigger_config),
        JSON.stringify(conditionsToStore),
        JSON.stringify(migratedRule.action || migratedRule.action_config),
        JSON.stringify(migratedRule.metadata || {}),
        0 // cooldown_minutes is deprecated - cooldown is now handled at user-level polling
      );
    }

    // Update master DB flag and reset polling
    const hasActive = rules.some(r => r.enabled);
    await this.updateMasterDbActiveRulesFlag(hasActive);
    
    // Invalidate cache since rules changed
    cache.invalidateActiveRules(this.authId);
    
    if (hasActive) {
      await this.resetNextPollAt();
    }
  }

  /**
   * Update rule status
   */
  async updateRuleStatus(ruleId, enabled) {
    const userDb = await this.getUserDb();
    userDb.prepare(`
      UPDATE automation_rules 
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(enabled ? 1 : 0, ruleId);

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
    const userDb = await this.getUserDb();
    userDb.prepare('DELETE FROM automation_rules WHERE id = ?').run(ruleId);

    // Invalidate cache since rule was deleted
    cache.invalidateActiveRules(this.authId);
    
    // Update master DB flag
    await this.syncActiveRulesFlag();
  }

  /**
   * Get rule execution history
   */
  async getRuleExecutionHistory(ruleId = null, limit = 100) {
    const userDb = await this.getUserDb();
    let sql = 'SELECT * FROM rule_execution_log';
    const params = [];
    
    if (ruleId) {
      sql += ' WHERE rule_id = ?';
      params.push(ruleId);
    }
    
    sql += ' ORDER BY executed_at DESC LIMIT ?';
    params.push(limit);
    
    return userDb.prepare(sql).all(...params);
  }

  /**
   * Clear rule execution history
   */
  async clearRuleExecutionHistory(ruleId = null) {
    const userDb = await this.getUserDb();
    if (ruleId) {
      // Clear logs for a specific rule
      userDb.prepare('DELETE FROM rule_execution_log WHERE rule_id = ?').run(ruleId);
    } else {
      // Clear all logs
      userDb.prepare('DELETE FROM rule_execution_log').run();
    }
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
      runningJobs: this.runningJobs.size
    };
  }

  shutdown() {
    logger.info('AutomationEngine shutting down', { authId: this.authId });
    this.runningJobs.clear();
  }
}

export default AutomationEngine;
