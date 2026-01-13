import logger from '../../utils/logger.js';

/**
 * Validator for automation rule configurations
 */
class RuleValidator {
  constructor(authId, migrateRuleToGroups) {
    this.authId = authId;
    this.migrateRuleToGroups = migrateRuleToGroups;
  }

  /**
   * Validate a single rule configuration
   * @param {Object} rule - Rule to validate
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validate(rule) {
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
    this.validateTrigger(rule, errors);

    // Validate action configuration
    this.validateAction(rule, errors);

    // Validate conditions/groups structure
    this.validateConditions(rule, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate trigger configuration
   * @param {Object} rule - Rule to validate
   * @param {Array} errors - Array to append errors to
   */
  validateTrigger(rule, errors) {
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
  }

  /**
   * Validate action configuration
   * @param {Object} rule - Rule to validate
   * @param {Array} errors - Array to append errors to
   */
  validateAction(rule, errors) {
    const action = rule.action || rule.action_config;
    if (!action) {
      errors.push('Rule must have an action configuration');
    } else if (typeof action !== 'object') {
      errors.push('Action must be an object');
    } else {
      if (!action.type || typeof action.type !== 'string') {
        errors.push('Action type is required and must be a string');
      } else {
        const validActionTypes = [
          'stop_seeding',
          'delete',
          'archive',
          'force_start',
          'add_tag',
          'remove_tag',
        ];
        if (!validActionTypes.includes(action.type)) {
          errors.push(
            `Invalid action type: ${action.type}. Valid types: ${validActionTypes.join(', ')}`
          );
        }

        // Validate action-specific fields
        if (action.type === 'add_tag' || action.type === 'remove_tag') {
          if (!Array.isArray(action.tagIds) || action.tagIds.length === 0) {
            errors.push(`${action.type} action requires tagIds to be a non-empty array`);
          } else {
            const invalidTagIds = action.tagIds.filter(
              (id) => typeof id !== 'number' || id <= 0 || !Number.isInteger(id)
            );
            if (invalidTagIds.length > 0) {
              errors.push(`${action.type} action tagIds must be positive integers`);
            }
          }
        }
      }
    }
  }

  /**
   * Validate conditions/groups structure
   * @param {Object} rule - Rule to validate
   * @param {Array} errors - Array to append errors to
   */
  validateConditions(rule, errors) {
    const migratedRule = this.migrateRuleToGroups(rule);
    const hasGroups =
      migratedRule.groups && Array.isArray(migratedRule.groups) && migratedRule.groups.length > 0;

    if (hasGroups) {
      this.validateGroupsStructure(migratedRule, errors);
    } else {
      this.validateFlatConditions(rule, errors);
    }
  }

  /**
   * Validate groups structure
   * @param {Object} rule - Migrated rule with groups
   * @param {Array} errors - Array to append errors to
   */
  validateGroupsStructure(rule, errors) {
    // Validate logic operator
    const logicOperator = rule.logicOperator || 'and';
    if (logicOperator !== 'and' && logicOperator !== 'or') {
      errors.push(`Logic operator must be 'and' or 'or', got: ${logicOperator}`);
    }

    // Validate groups structure
    if (!Array.isArray(rule.groups)) {
      errors.push('Groups must be an array');
    } else {
      rule.groups.forEach((group, groupIndex) => {
        this.validateGroup(group, groupIndex, errors);
      });
    }
  }

  /**
   * Validate a single group
   * @param {Object} group - Group to validate
   * @param {number} groupIndex - Index of the group
   * @param {Array} errors - Array to append errors to
   */
  validateGroup(group, groupIndex, errors) {
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
          ruleName: group.name,
          groupIndex,
        });
      }

      // Validate each condition
      conditions.forEach((condition, condIndex) => {
        this.validateCondition(condition, groupIndex, condIndex, errors);
      });
    }
  }

  /**
   * Validate a single condition
   * @param {Object} condition - Condition to validate
   * @param {number} groupIndex - Index of the group
   * @param {number} condIndex - Index of the condition
   * @param {Array} errors - Array to append errors to
   */
  validateCondition(condition, groupIndex, condIndex, errors) {
    if (typeof condition !== 'object' || condition === null) {
      errors.push(`Group ${groupIndex}, condition ${condIndex} must be an object`);
      return;
    }

    // Validate condition type
    if (!condition.type || typeof condition.type !== 'string') {
      errors.push(`Group ${groupIndex}, condition ${condIndex} must have a type string`);
    } else {
      const validConditionTypes = [
        'SEEDING_TIME',
        'AGE',
        'LAST_DOWNLOAD_ACTIVITY_AT',
        'LAST_UPLOAD_ACTIVITY_AT',
        'PROGRESS',
        'DOWNLOAD_SPEED',
        'UPLOAD_SPEED',
        'AVG_DOWNLOAD_SPEED',
        'AVG_UPLOAD_SPEED',
        'ETA',
        'DOWNLOAD_STALLED_TIME',
        'UPLOAD_STALLED_TIME',
        'SEEDS',
        'PEERS',
        'RATIO',
        'TOTAL_UPLOADED',
        'TOTAL_DOWNLOADED',
        'FILE_SIZE',
        'FILE_COUNT',
        'NAME',
        'TRACKER',
        'PRIVATE',
        'CACHED',
        'AVAILABILITY',
        'ALLOW_ZIP',
        'IS_ACTIVE',
        'SEEDING_ENABLED',
        'LONG_TERM_SEEDING',
        'STATUS',
        'EXPIRES_AT',
        'TAGS',
      ];
      if (!validConditionTypes.includes(condition.type)) {
        errors.push(
          `Group ${groupIndex}, condition ${condIndex} has invalid type: ${condition.type}`
        );
      }
    }

    // Validate operator
    if (condition.operator !== undefined) {
      const validOperators = this.getValidOperators();
      if (!validOperators.includes(condition.operator)) {
        errors.push(
          `Group ${groupIndex}, condition ${condIndex} has invalid operator: ${condition.operator}`
        );
      }
    }

    // Validate value
    this.validateConditionValue(condition, groupIndex, condIndex, errors);

    // Type-specific validations
    this.validateConditionTypeSpecific(condition, groupIndex, condIndex, errors);
  }

  /**
   * Get list of valid operators
   * @returns {Array<string>} - Array of valid operator strings
   */
  getValidOperators() {
    return [
      // Numeric/comparison operators
      'gt',
      'lt',
      'gte',
      'lte',
      'eq',
      // Tag operators (backend format)
      'has_any',
      'has_all',
      'has_none',
      // Tag operators (frontend format - will be mapped in RuleEvaluator)
      'is_any_of',
      'is_all_of',
      'is_none_of',
      // Multi-select operators (for STATUS)
      'is_any_of',
      'is_none_of',
      // String operators (for NAME, TRACKER)
      'contains',
      'not_contains',
      'equals',
      'not_equals',
      'starts_with',
      'ends_with',
      // Boolean operators
      'is_true',
      'is_false',
    ];
  }

  /**
   * Validate condition value
   * @param {Object} condition - Condition to validate
   * @param {number} groupIndex - Index of the group
   * @param {number} condIndex - Index of the condition
   * @param {Array} errors - Array to append errors to
   */
  validateConditionValue(condition, groupIndex, condIndex, errors) {
    if (condition.value === undefined && condition.type !== 'NAME') {
      // NAME condition doesn't require operator, but needs value
      if (condition.type === 'NAME' && !condition.value) {
        errors.push(`Group ${groupIndex}, condition ${condIndex} (NAME) must have a value`);
      } else if (condition.type !== 'NAME') {
        errors.push(`Group ${groupIndex}, condition ${condIndex} must have a value`);
      }
    }
  }

  /**
   * Validate type-specific condition requirements
   * @param {Object} condition - Condition to validate
   * @param {number} groupIndex - Index of the group
   * @param {number} condIndex - Index of the condition
   * @param {Array} errors - Array to append errors to
   */
  validateConditionTypeSpecific(condition, groupIndex, condIndex, errors) {
    if (condition.type === 'STATUS' && !Array.isArray(condition.value)) {
      errors.push(`Group ${groupIndex}, condition ${condIndex} (STATUS) value must be an array`);
    }
    if (condition.type === 'TAGS' && !Array.isArray(condition.value)) {
      errors.push(`Group ${groupIndex}, condition ${condIndex} (TAGS) value must be an array`);
    }
    if (
      (condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED') &&
      condition.hours !== undefined &&
      (typeof condition.hours !== 'number' || condition.hours <= 0)
    ) {
      errors.push(
        `Group ${groupIndex}, condition ${condIndex} (${condition.type}) hours must be a positive number`
      );
    }
  }

  /**
   * Validate flat conditions structure (legacy format)
   * @param {Object} rule - Rule to validate
   * @param {Array} errors - Array to append errors to
   */
  validateFlatConditions(rule, errors) {
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
}

export default RuleValidator;
