/**
 * Helper for migrating rules to groups structure
 */
class RuleMigrationHelper {
  /**
   * Migrate old flat conditions structure to new group structure
   * @param {Object} rule - Rule to migrate
   * @returns {Object} - Migrated rule
   */
  static migrateRuleToGroups(rule) {
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
}

export default RuleMigrationHelper;
