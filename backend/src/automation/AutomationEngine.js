import RuleEvaluator from './RuleEvaluator.js';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';
import logger from '../utils/logger.js';

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
    this.runningJobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Get a fresh database connection from the manager
   * This ensures we always have a valid connection even if the pool closed it
   */
  async getUserDb() {
    const userDb = await this.userDatabaseManager.getUserDatabase(this.authId);
    return userDb.db;
  }

  /**
   * Get RuleEvaluator with a fresh database connection
   * Always gets a fresh DB connection to avoid using closed databases
   */
  async getRuleEvaluator() {
    // Always get a fresh database connection to avoid using closed databases
    const userDb = await this.getUserDb();
    // Create a new RuleEvaluator with the fresh connection
    // We don't cache it because the database connection might get closed
    return new RuleEvaluator(userDb, this.apiClient);
  }

  async initialize() {
    try {
      logger.info('AutomationEngine initializing', { authId: this.authId });
      
      // Initialize rule evaluator
      await this.getRuleEvaluator();
      
      // Load existing rules from user database
      const rules = await this.getAutomationRules();
      
      // Start all enabled rules
      for (const rule of rules) {
        if (rule.enabled) {
          await this.startRule(rule);
        }
      }
      
      // Sync active rules flag to master DB
      await this.syncActiveRulesFlag();
      
      this.isInitialized = true;
      logger.info('AutomationEngine initialized', {
        authId: this.authId,
        totalRules: rules.length,
        enabledRules: rules.filter(r => r.enabled).length,
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
   */
  async getAutomationRules() {
    const userDb = await this.getUserDb();
    const sql = 'SELECT * FROM automation_rules ORDER BY created_at DESC';
    const rules = userDb.prepare(sql).all();
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
        cooldown_minutes: rule.cooldown_minutes || 0,
        last_executed_at: rule.last_executed_at,
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
    const userDb = await this.getUserDb();
    const result = userDb.prepare(`
      SELECT COUNT(*) as count 
      FROM automation_rules 
      WHERE enabled = 1
    `).get();
    return result && result.count > 0;
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
   */
  async resetNextPollAt() {
    if (!this.masterDb) {
      return; // Master DB not available
    }
    try {
      const nextPollAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      this.masterDb.updateNextPollAt(this.authId, nextPollAt, 0); // Count will be updated on next poll
    } catch (error) {
      logger.error('Failed to reset next poll timestamp', error, {
        authId: this.authId,
      });
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

      const rules = await this.getAutomationRules();
      const enabledRules = rules.filter(r => r.enabled);

      logger.debug('Rules loaded', {
        authId: this.authId,
        totalRules: rules.length,
        enabledRules: enabledRules.length,
        disabledRules: rules.length - enabledRules.length
      });

      if (enabledRules.length === 0) {
        logger.debug('No enabled rules to evaluate', {
          authId: this.authId,
          totalRules: rules.length
        });
        return { evaluated: 0, executed: 0 };
      }

      logger.info('Evaluating automation rules', {
        authId: this.authId,
        enabledRuleCount: enabledRules.length,
        torrentCount: torrents.length,
        ruleNames: enabledRules.map(r => r.name)
      });

      let executedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const rule of enabledRules) {
        try {
          // Check cooldown
          if (rule.cooldown_minutes && rule.last_executed_at) {
            const lastExecuted = new Date(rule.last_executed_at);
            const cooldownMs = rule.cooldown_minutes * 60 * 1000;
            const timeSinceLastExecution = Date.now() - lastExecuted.getTime();
            
            if (timeSinceLastExecution < cooldownMs) {
              const remainingCooldownMinutes = ((cooldownMs - timeSinceLastExecution) / (60 * 1000)).toFixed(1);
              logger.debug('Rule skipped due to cooldown', {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                cooldownMinutes: rule.cooldown_minutes,
                remainingCooldownMinutes,
                lastExecutedAt: rule.last_executed_at,
                timeSinceLastExecution: `${(timeSinceLastExecution / 1000).toFixed(1)}s`
              });
              skippedCount++;
              continue; // Still in cooldown
            }
          }

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
            continue;
          }

          // Evaluate rule
          const ruleEvaluator = await this.getRuleEvaluator();
          const matchingTorrents = await ruleEvaluator.evaluateRule(rule, torrents);

          if (matchingTorrents.length === 0) {
            logger.debug('Rule did not match any torrents', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              torrentCount: torrents.length
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

          // Execute actions
          let successCount = 0;
          let errorCount = 0;

          for (const torrent of matchingTorrents) {
            try {
              const ruleEvaluator = await this.getRuleEvaluator();
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
              logger.error('Action failed for torrent', error, {
                authId: this.authId,
                ruleId: rule.id,
                ruleName: rule.name,
                torrentId: torrent.id,
                torrentName: torrent.name,
                torrentStatus: this.ruleEvaluator.getTorrentStatus(torrent),
                action: rule.action?.type
              });
              errorCount++;
            }
          }

          // Update rule execution status and set 5-minute cooldown
          const userDb = await this.getUserDb();
          userDb.prepare(`
            UPDATE automation_rules 
            SET last_executed_at = CURRENT_TIMESTAMP,
                execution_count = execution_count + 1,
                cooldown_minutes = 5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(rule.id);

          // Log execution
          await this.logRuleExecution(
            rule.id,
            rule.name,
            'execution',
            matchingTorrents.length,
            errorCount === 0,
            errorCount > 0 ? `${errorCount} actions failed` : null
          );

          executedCount++;
          
          logger.info('Rule execution completed', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            matchedCount: matchingTorrents.length,
            successCount,
            errorCount,
            totalActions: matchingTorrents.length
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
   * Save automation rules
   */
  async saveAutomationRules(rules) {
    const userDb = await this.getUserDb();
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
        migratedRule.cooldown_minutes || 0
      );
    }

    // Update master DB flag and reset polling
    const hasActive = rules.some(r => r.enabled);
    await this.updateMasterDbActiveRulesFlag(hasActive);
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
      
      // Reload rules from database
      const rules = await this.getAutomationRules();
      
      // Start enabled rules
      for (const rule of rules) {
        if (rule.enabled) {
          await this.startRule(rule);
        }
      }
      
      logger.info('Rules reloaded', {
        authId: this.authId,
        totalRules: rules.length,
        enabledRules: rules.filter(r => r.enabled).length,
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
