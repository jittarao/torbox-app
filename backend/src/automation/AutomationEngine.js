import RuleEvaluator from './RuleEvaluator.js';
import ApiClient from '../api/ApiClient.js';
import { decrypt } from '../utils/crypto.js';

/**
 * Per-user Automation Engine
 * Evaluates and executes automation rules for a single user
 */
class AutomationEngine {
  constructor(authId, encryptedApiKey, userDb, masterDb = null) {
    this.authId = authId;
    this.encryptedApiKey = encryptedApiKey;
    this.userDb = userDb;
    this.masterDb = masterDb;
    this.apiKey = decrypt(encryptedApiKey);
    this.apiClient = new ApiClient(this.apiKey);
    this.ruleEvaluator = new RuleEvaluator(userDb, this.apiClient);
    this.runningJobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log(`[AutomationEngine ${this.authId}] Initializing...`);
      
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
      console.log(`[AutomationEngine ${this.authId}] Initialized with ${rules.length} rules`);
    } catch (error) {
      console.error(`[AutomationEngine ${this.authId}] Failed to initialize:`, error);
      throw error;
    }
  }

  /**
   * Get automation rules from user database
   */
  async getAutomationRules() {
    const sql = 'SELECT * FROM automation_rules ORDER BY created_at DESC';
    const rules = this.userDb.prepare(sql).all();
    return rules.map(rule => ({
      ...rule,
      enabled: rule.enabled === 1,
      trigger_config: JSON.parse(rule.trigger_config),
      conditions: JSON.parse(rule.conditions),
      action_config: JSON.parse(rule.action_config),
      metadata: rule.metadata ? JSON.parse(rule.metadata) : null,
      cooldown_minutes: rule.cooldown_minutes || 0,
      last_executed_at: rule.last_executed_at,
      execution_count: rule.execution_count || 0
    }));
  }

  /**
   * Check if user has any enabled automation rules
   * @returns {boolean} - True if at least one rule is enabled
   */
  hasActiveRules() {
    const result = this.userDb.prepare(`
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
      return; // Master DB not available
    }
    try {
      this.masterDb.updateActiveRulesFlag(this.authId, hasActiveRules);
    } catch (error) {
      console.error(`[AutomationEngine ${this.authId}] Failed to update active rules flag:`, error);
    }
  }

  /**
   * Sync active rules flag to master database
   */
  async syncActiveRulesFlag() {
    const hasActive = this.hasActiveRules();
    await this.updateMasterDbActiveRulesFlag(hasActive);
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
      console.error(`[AutomationEngine ${this.authId}] Failed to reset next poll at:`, error);
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
      
      console.log(`[AutomationEngine ${this.authId}] Rule ${rule.name} ready`);
    } catch (error) {
      console.error(`[AutomationEngine ${this.authId}] Failed to start rule ${rule.name}:`, error);
    }
  }

  stopRule(ruleId) {
    if (this.runningJobs.has(ruleId)) {
      this.runningJobs.delete(ruleId);
      console.log(`[AutomationEngine ${this.authId}] Stopped rule ${ruleId}`);
    }
  }

  /**
   * Evaluate and execute rules (called after each poll)
   * @param {Array} torrents - Current torrents from API
   */
  async evaluateRules(torrents) {
    try {
      const rules = await this.getAutomationRules();
      const enabledRules = rules.filter(r => r.enabled);

      if (enabledRules.length === 0) {
        return { evaluated: 0, executed: 0 };
      }

      let executedCount = 0;

      for (const rule of enabledRules) {
        try {
          // Check cooldown
          if (rule.cooldown_minutes && rule.last_executed_at) {
            const lastExecuted = new Date(rule.last_executed_at);
            const cooldownMs = rule.cooldown_minutes * 60 * 1000;
            const timeSinceLastExecution = Date.now() - lastExecuted.getTime();
            
            if (timeSinceLastExecution < cooldownMs) {
              continue; // Still in cooldown
            }
          }

          // Evaluate rule
          const matchingTorrents = await this.ruleEvaluator.evaluateRule(rule, torrents);

          if (matchingTorrents.length === 0) {
            continue;
          }

          console.log(`[AutomationEngine ${this.authId}] Rule ${rule.name} matched ${matchingTorrents.length} torrents`);

          // Execute actions
          let successCount = 0;
          let errorCount = 0;

          for (const torrent of matchingTorrents) {
            try {
              await this.ruleEvaluator.executeAction(rule.action_config, torrent);
              successCount++;
            } catch (error) {
              console.error(`[AutomationEngine ${this.authId}] Action failed for torrent ${torrent.id}:`, error);
              errorCount++;
            }
          }

          // Update rule execution status
          this.userDb.prepare(`
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
            matchingTorrents.length,
            errorCount === 0,
            errorCount > 0 ? `${errorCount} actions failed` : null
          );

          executedCount++;
        } catch (error) {
          console.error(`[AutomationEngine ${this.authId}] Rule evaluation failed for ${rule.name}:`, error);
          await this.logRuleExecution(rule.id, rule.name, 'execution', 0, false, error.message);
        }
      }

      return { evaluated: enabledRules.length, executed: executedCount };
    } catch (error) {
      console.error(`[AutomationEngine ${this.authId}] Failed to evaluate rules:`, error);
      return { evaluated: 0, executed: 0, error: error.message };
    }
  }

  /**
   * Log rule execution
   */
  async logRuleExecution(ruleId, ruleName, executionType, itemsProcessed = 0, success = true, errorMessage = null) {
    const sql = `
      INSERT INTO rule_execution_log (rule_id, rule_name, execution_type, items_processed, success, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    this.userDb.prepare(sql).run(ruleId, ruleName, executionType, itemsProcessed, success ? 1 : 0, errorMessage);
  }

  /**
   * Save automation rules
   */
  async saveAutomationRules(rules) {
    // Clear existing rules
    this.userDb.prepare('DELETE FROM automation_rules').run();
    
    // Insert new rules
    for (const rule of rules) {
      const sql = `
        INSERT INTO automation_rules (name, enabled, trigger_config, conditions, action_config, metadata, cooldown_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      this.userDb.prepare(sql).run(
        rule.name,
        rule.enabled ? 1 : 0,
        JSON.stringify(rule.trigger || rule.trigger_config),
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.action || rule.action_config),
        JSON.stringify(rule.metadata || {}),
        rule.cooldown_minutes || 0
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
    this.userDb.prepare(`
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
    this.userDb.prepare('DELETE FROM automation_rules WHERE id = ?').run(ruleId);

    // Update master DB flag
    await this.syncActiveRulesFlag();
  }

  /**
   * Get rule execution history
   */
  getRuleExecutionHistory(ruleId = null, limit = 100) {
    let sql = 'SELECT * FROM rule_execution_log';
    const params = [];
    
    if (ruleId) {
      sql += ' WHERE rule_id = ?';
      params.push(ruleId);
    }
    
    sql += ' ORDER BY executed_at DESC LIMIT ?';
    params.push(limit);
    
    return this.userDb.prepare(sql).all(...params);
  }

  async reloadRules() {
    try {
      console.log(`[AutomationEngine ${this.authId}] Reloading rules...`);
      
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
      
      console.log(`[AutomationEngine ${this.authId}] Reloaded ${rules.length} rules`);
    } catch (error) {
      console.error(`[AutomationEngine ${this.authId}] Failed to reload rules:`, error);
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
    console.log(`[AutomationEngine ${this.authId}] Shutting down...`);
    this.runningJobs.clear();
  }
}

export default AutomationEngine;
