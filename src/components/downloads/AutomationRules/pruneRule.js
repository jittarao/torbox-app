import { ACTION_TYPES, CONDITION_TYPES } from './constants';
import { getSupportedActions, getSupportedConditions } from './capabilities';
import {
  getDefaultOperatorForConditionType,
  getDefaultValueForConditionType,
} from './utils';

/**
 * Remove conditions/actions unsupported for the given asset types (intersection).
 * @param {Object} rule
 * @param {string[]} assetTypes
 * @returns {Object}
 */
export function pruneRuleForAssetTypes(rule, assetTypes) {
  const allowedConditions = new Set(getSupportedConditions(assetTypes));
  const allowedActions = new Set(getSupportedActions(assetTypes));

  const groups = (rule.groups || []).map((group) => ({
    ...group,
    conditions: (group.conditions || []).filter((c) => allowedConditions.has(c.type)),
  }));

  let action = rule.action;
  if (!action?.type || !allowedActions.has(action.type)) {
    const firstAction = getSupportedActions(assetTypes)[0] || ACTION_TYPES.DELETE;
    if (firstAction === ACTION_TYPES.ADD_TAG || firstAction === ACTION_TYPES.REMOVE_TAG) {
      action = { type: firstAction, tagIds: [] };
    } else {
      action = { type: firstAction };
    }
  }

  const defaultConditionType =
    getSupportedConditions(assetTypes)[0] || CONDITION_TYPES.STATUS;

  for (const group of groups) {
    if (group.conditions.length === 0) {
      group.conditions.push({
        type: defaultConditionType,
        operator: getDefaultOperatorForConditionType(defaultConditionType),
        value: getDefaultValueForConditionType(defaultConditionType),
      });
    }
  }

  return {
    ...rule,
    assetTypes,
    groups,
    action,
  };
}
