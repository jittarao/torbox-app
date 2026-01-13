import logger from '../../utils/logger.js';
import RuleMigrationHelper from './RuleMigrationHelper.js';

/**
 * Repository for automation rule database operations
 */
class RuleRepository {
  constructor(authId, getUserDb) {
    this.authId = authId;
    this.getUserDb = getUserDb;
  }

  /**
   * Get automation rules from user database
   * Always returns rules in the new group structure format
   * @param {Object} options - Optional filter options
   * @param {boolean} options.enabled - If true, only fetch enabled rules. If false, only fetch disabled rules. If undefined, fetch all rules.
   * @returns {Promise<Array>} - Array of automation rules
   */
  async getRules(options = {}) {
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

    return rules.map((rule) => {
      const mappedRule = this.mapRuleFromDb(rule);
      return RuleMigrationHelper.migrateRuleToGroups(mappedRule);
    });
  }

  /**
   * Map database row to rule object
   * @param {Object} rule - Database row
   * @returns {Object} - Rule object
   */
  mapRuleFromDb(rule) {
    const parsedConditions = JSON.parse(rule.conditions);

    // Check if conditions is actually groups structure
    const hasGroups =
      parsedConditions &&
      typeof parsedConditions === 'object' &&
      Array.isArray(parsedConditions.groups) &&
      parsedConditions.groups.length > 0;

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

    return ruleObj;
  }

  /**
   * Check if user has any enabled automation rules
   * @returns {Promise<boolean>} - True if at least one rule is enabled
   */
  async hasActiveRules() {
    const userDb = await this.getUserDb();
    const result = userDb
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM automation_rules 
      WHERE enabled = 1
    `
      )
      .get();
    return result && result.count > 0;
  }

  /**
   * Check if any rules have executed recently (within specified hours)
   * @param {number} hours - Number of hours to look back (default: 1)
   * @returns {Promise<boolean>} - True if any enabled rule executed recently
   */
  async hasRecentRuleExecutions(hours = 1) {
    const userDb = await this.getUserDb();
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const result = userDb
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM automation_rules 
      WHERE enabled = 1 
        AND last_executed_at IS NOT NULL
        AND last_executed_at >= ?
    `
      )
      .get(hoursAgo);

    return result && result.count > 0;
  }

  /**
   * Update rule's last evaluated timestamp
   * @param {number} ruleId - Rule ID
   */
  async updateLastEvaluatedAt(ruleId) {
    try {
      const userDb = await this.getUserDb();
      userDb
        .prepare(
          `
        UPDATE automation_rules 
        SET last_evaluated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
        )
        .run(ruleId);
    } catch (error) {
      // Log but don't fail - column should exist via migration
      logger.debug('Failed to update last_evaluated_at (non-critical)', {
        authId: this.authId,
        ruleId,
        errorMessage: error.message,
      });
    }
  }

  /**
   * Update rule execution status
   * @param {number} ruleId - Rule ID
   */
  async updateExecutionStatus(ruleId) {
    const userDb = await this.getUserDb();
    userDb
      .prepare(
        `
      UPDATE automation_rules 
      SET last_executed_at = CURRENT_TIMESTAMP,
          execution_count = execution_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
      )
      .run(ruleId);
  }

  /**
   * Save automation rules (replaces all existing rules)
   * @param {Array} rules - Array of rule objects
   */
  async saveRules(rules) {
    const userDb = await this.getUserDb();

    // Clear existing rules
    userDb.prepare('DELETE FROM automation_rules').run();

    // Insert new rules
    for (const rule of rules) {
      // Migrate rule to group structure if needed
      const migratedRule = RuleMigrationHelper.migrateRuleToGroups(rule);

      // Store groups structure in conditions field
      const conditionsToStore =
        migratedRule.groups && Array.isArray(migratedRule.groups)
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
        0 // cooldown_minutes is deprecated
      );
    }
  }

  /**
   * Update rule status (enabled/disabled)
   * @param {number} ruleId - Rule ID
   * @param {boolean} enabled - Whether rule is enabled
   */
  async updateRuleStatus(ruleId, enabled) {
    const userDb = await this.getUserDb();
    userDb
      .prepare(
        `
      UPDATE automation_rules 
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `
      )
      .run(enabled ? 1 : 0, ruleId);
  }

  /**
   * Delete a rule
   * @param {number} ruleId - Rule ID
   */
  async deleteRule(ruleId) {
    const userDb = await this.getUserDb();
    userDb.prepare('DELETE FROM automation_rules WHERE id = ?').run(ruleId);
  }

  /**
   * Get rule execution history
   * @param {number|null} ruleId - Optional rule ID to filter by
   * @param {number} limit - Maximum number of records to return
   * @returns {Promise<Array>} - Array of execution log records
   */
  async getExecutionHistory(ruleId = null, limit = 100) {
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
   * @param {number|null} ruleId - Optional rule ID to filter by
   */
  async clearExecutionHistory(ruleId = null) {
    const userDb = await this.getUserDb();
    if (ruleId) {
      userDb.prepare('DELETE FROM rule_execution_log WHERE rule_id = ?').run(ruleId);
    } else {
      userDb.prepare('DELETE FROM rule_execution_log').run();
    }
  }

  /**
   * Log rule execution
   * @param {number} ruleId - Rule ID
   * @param {string} ruleName - Rule name
   * @param {string} executionType - Type of execution
   * @param {number} itemsProcessed - Number of items processed
   * @param {boolean} success - Whether execution was successful
   * @param {string|null} errorMessage - Error message if failed
   */
  async logExecution(
    ruleId,
    ruleName,
    executionType,
    itemsProcessed = 0,
    success = true,
    errorMessage = null
  ) {
    try {
      // Validate required parameters
      if (ruleId == null || ruleName == null || executionType == null) {
        logger.warn('Invalid parameters for rule execution log', {
          authId: this.authId,
          ruleId,
          ruleName,
          executionType,
        });
        return;
      }

      const userDb = await this.getUserDb();
      const sql = `
        INSERT INTO rule_execution_log (rule_id, rule_name, execution_type, items_processed, success, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      userDb
        .prepare(sql)
        .run(ruleId, ruleName, executionType, itemsProcessed, success ? 1 : 0, errorMessage);
      logger.debug('Rule execution logged successfully', {
        authId: this.authId,
        ruleId,
        ruleName,
        executionType,
        itemsProcessed,
        success,
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
        errorMessage,
      });
    }
  }
}

export default RuleRepository;
