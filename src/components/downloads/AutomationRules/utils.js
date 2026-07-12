import {
  CONDITION_TYPES,
  ACTION_TYPES,
  LOGIC_OPERATORS,
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
  AUTOMATION_TAG_OPERATORS,
} from './constants';
import { getSupportedActions, getSupportedConditions } from './capabilities';
import {
  getGroupedFilterFields,
  getConditionUnitFromRegistry,
  getColumnKeyForConditionType,
  getConditionValueKind,
} from '../filters/filterFieldRegistry';

// Helper to check if a condition type is time-based (relative duration)
export const isTimeBasedCondition = (conditionType) => {
  return getConditionValueKind(conditionType) === 'time';
};

export const isTimestampBasedCondition = (conditionType) => {
  return getConditionValueKind(conditionType) === 'timestamp';
};

export const isBooleanCondition = (conditionType) => {
  return getConditionValueKind(conditionType) === 'boolean';
};

// Helper to check if a condition type is string-based
export const isStringCondition = (conditionType) => {
  return [CONDITION_TYPES.TRACKER, CONDITION_TYPES.NAME, CONDITION_TYPES.ORIGINAL_URL].includes(
    conditionType
  );
};

// Helper to check if a condition type requires hours parameter
export const isSpeedAverageCondition = (conditionType) => {
  return [CONDITION_TYPES.AVG_DOWNLOAD_SPEED, CONDITION_TYPES.AVG_UPLOAD_SPEED].includes(
    conditionType
  );
};

export const getConditionText = (conditions, logicOperator, t, commonT) => {
  const conditionTexts = conditions.map((condition) => {
    const operator = condition.operator;
    const isTimeBased = isTimeBasedCondition(condition.type);
    const isTimestampBased = isTimestampBasedCondition(condition.type);
    const timeOpT = isTimeBased ? t(`timeOperators.${operator}`) : null;
    const timestampOpT = isTimestampBased ? t(`timestampOperators.${operator}`) : null;
    const textOpT = isStringCondition(condition.type) ? t(`stringOperators.${operator}`) : null;
    const usesNumericComparisonLabels =
      !isTimeBased &&
      !isTimestampBased &&
      !isStringCondition(condition.type) &&
      !isBooleanCondition(condition.type) &&
      condition.type !== CONDITION_TYPES.STATUS &&
      condition.type !== CONDITION_TYPES.TAGS;
    const numOpT = usesNumericComparisonLabels ? t(`operators.${operator}`) : null;

    // Time / State
    if (condition.type === CONDITION_TYPES.SEEDING_TIME) {
      if (operator === 'gt' || operator === 'gte') {
        return `seeding for ${timeOpT} ${condition.value} ${commonT('hours')}`;
      } else if (operator === 'lt' || operator === 'lte') {
        return `seeding for ${timeOpT} ${condition.value} ${commonT('hours')}`;
      } else {
        return `seeding time ${timeOpT} ${condition.value} ${commonT('hours')}`;
      }
    } else if (condition.type === CONDITION_TYPES.AGE) {
      if (operator === 'gt' || operator === 'gte') {
        return `created ${timeOpT} ${condition.value} ${commonT('hours')} ago`;
      } else if (operator === 'lt' || operator === 'lte') {
        return `created ${timeOpT} ${condition.value} ${commonT('hours')} ago`;
      } else {
        return `age ${timeOpT} ${condition.value} ${commonT('hours')}`;
      }
    } else if (condition.type === CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT) {
      return `last download activity was ${timestampOpT} ${condition.value} minutes ago`;
    } else if (condition.type === CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT) {
      return `last upload activity was ${timestampOpT} ${condition.value} minutes ago`;
    }
    // Progress & Performance (numeric)
    else if (condition.type === CONDITION_TYPES.PROGRESS) {
      return `progress ${numOpT} ${condition.value}%`;
    } else if (condition.type === CONDITION_TYPES.DOWNLOAD_SPEED) {
      return `download speed ${numOpT} ${condition.value} MB/s`;
    } else if (condition.type === CONDITION_TYPES.UPLOAD_SPEED) {
      return `upload speed ${numOpT} ${condition.value} MB/s`;
    } else if (condition.type === CONDITION_TYPES.AVG_DOWNLOAD_SPEED) {
      const hours = condition.hours || 1;
      return `avg download speed ${numOpT} ${condition.value} MB/s calculated over ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else if (condition.type === CONDITION_TYPES.AVG_UPLOAD_SPEED) {
      const hours = condition.hours || 1;
      return `avg upload speed ${numOpT} ${condition.value} MB/s calculated over ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else if (condition.type === CONDITION_TYPES.ETA) {
      const etaValue = condition.value; // value is in minutes
      let etaDisplay = '';
      if (etaValue >= 60) {
        const hours = Math.floor(etaValue / 60);
        const minutes = etaValue % 60;
        if (minutes > 0) {
          etaDisplay = `${hours}h ${minutes}m`;
        } else {
          etaDisplay = `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
      } else {
        etaDisplay = `${etaValue} minute${etaValue !== 1 ? 's' : ''}`;
      }
      return `ETA ${numOpT} ${etaDisplay}`;
    }
    // Stall & Inactivity (time-based)
    else if (condition.type === CONDITION_TYPES.DOWNLOAD_STALLED_TIME) {
      return `download stalled for ${timeOpT} ${condition.value} minutes`;
    } else if (condition.type === CONDITION_TYPES.UPLOAD_STALLED_TIME) {
      return `upload stalled for ${timeOpT} ${condition.value} minutes`;
    }
    // Swarm & Ratio (numeric)
    else if (condition.type === CONDITION_TYPES.SEEDS) {
      return `seeds ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.PEERS) {
      return `peers ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.RATIO) {
      return `seeding ratio ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.TOTAL_UPLOADED) {
      return `total uploaded ${numOpT} ${condition.value} GB`;
    } else if (condition.type === CONDITION_TYPES.TOTAL_DOWNLOADED) {
      return `total downloaded ${numOpT} ${condition.value} MB`;
    }
    // Content & Metadata (numeric)
    else if (condition.type === CONDITION_TYPES.FILE_SIZE) {
      return `file size ${numOpT} ${condition.value} GB`;
    } else if (condition.type === CONDITION_TYPES.FILE_COUNT) {
      return `file count ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.NAME) {
      return `name ${textOpT} "${condition.value}"`;
    } else if (condition.type === CONDITION_TYPES.PRIVATE) {
      const isPrivate =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isPrivate ? 'private' : 'public'}`;
    } else if (condition.type === CONDITION_TYPES.CACHED) {
      const isCached =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isCached ? 'cached' : 'not cached'}`;
    } else if (condition.type === CONDITION_TYPES.AVAILABILITY) {
      return `availability ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.ALLOW_ZIP) {
      const allowZip =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${allowZip ? 'zip allowed' : 'zip not allowed'}`;
    }
    // Lifecycle
    else if (condition.type === CONDITION_TYPES.IS_ACTIVE) {
      const isActive =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isActive ? 'active' : 'inactive'}`;
    } else if (condition.type === CONDITION_TYPES.IS_AIRLOCKED) {
      const isAirlocked =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isAirlocked ? 'airlocked' : 'not airlocked'}`;
    } else if (condition.type === CONDITION_TYPES.SEEDING_ENABLED) {
      const seedingEnabled =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `seeding is ${seedingEnabled ? 'enabled' : 'disabled'}`;
    } else if (condition.type === CONDITION_TYPES.LONG_TERM_SEEDING) {
      const longTermSeeding =
        condition.value === true || condition.value === 1 || condition.value === 'true';
      return `long-term seeding is ${longTermSeeding ? 'enabled' : 'disabled'}`;
    } else if (condition.type === CONDITION_TYPES.STATUS) {
      // STATUS value must be an array
      if (!Array.isArray(condition.value)) {
        return 'status is (invalid)';
      }
      if (condition.value.length === 0) {
        return 'status is (none selected)';
      } else if (condition.value.length === 1) {
        return `status is ${condition.value[0]}`;
      } else {
        return `status is ${condition.value.join(', ')}`;
      }
    } else if (condition.type === CONDITION_TYPES.TAGS) {
      if (!Array.isArray(condition.value)) {
        return 'tags (invalid)';
      }
      const labels = {
        [TAG_OPERATORS.IS_ANY_OF]: t('tagOperators.isAnyOf'),
        [TAG_OPERATORS.IS_ALL_OF]: t('tagOperators.isAllOf'),
        [TAG_OPERATORS.IS_NONE_OF]: t('tagOperators.isNoneOf'),
        [TAG_OPERATORS.IS_SET]: t('tagOperators.isSet'),
        [TAG_OPERATORS.IS_NOT_SET]: t('tagOperators.isNotSet'),
      };
      const operatorText = labels[condition.operator] || condition.operator;
      if (
        condition.operator === TAG_OPERATORS.IS_SET ||
        condition.operator === TAG_OPERATORS.IS_NOT_SET
      ) {
        return `tags ${operatorText}`;
      }
      if (condition.value.length === 0) {
        return 'tags (none selected)';
      }
      return `tags ${operatorText} ${condition.value.length} tag${condition.value.length !== 1 ? 's' : ''}`;
    } else if (condition.type === CONDITION_TYPES.EXPIRES_AT) {
      if (operator === 'lt' || operator === 'lte') {
        return `expires within ${condition.value} hours`;
      } else if (operator === 'gt' || operator === 'gte') {
        return `expires in ${timestampOpT} ${condition.value} hours`;
      } else {
        return `expires in ${timestampOpT} ${condition.value} hours`;
      }
    } else if (condition.type === CONDITION_TYPES.TRACKER) {
      return `tracker ${textOpT} "${condition.value}"`;
    } else if (condition.type === CONDITION_TYPES.ORIGINAL_URL) {
      return `source url ${textOpT} "${condition.value}"`;
    }

    return '';
  });

  const logicText = logicOperator === LOGIC_OPERATORS.AND ? ' AND ' : ' OR ';
  return conditionTexts.join(logicText);
};

/** Human-readable condition summary for a rule with group AND/OR structure */
export const getRuleConditionText = (rule, t, commonT) => {
  const groups = rule?.groups || [];
  if (groups.length === 0) return '';

  const groupTexts = groups
    .map((group) => {
      const conditions = group.conditions || [];
      if (conditions.length === 0) return '';
      const groupLogic = group.logicOperator || LOGIC_OPERATORS.AND;
      const inner = getConditionText(conditions, groupLogic, t, commonT);
      return conditions.length > 1 ? `(${inner})` : inner;
    })
    .filter(Boolean);

  if (groupTexts.length === 0) return '';
  if (groupTexts.length === 1) return groupTexts[0];

  const ruleLogic = rule.logicOperator || LOGIC_OPERATORS.AND;
  const logicText = ruleLogic === LOGIC_OPERATORS.AND ? ' AND ' : ' OR ';
  return groupTexts.join(logicText);
};

export const getConditionUnit = (conditionType) => {
  return getConditionUnitFromRegistry(conditionType);
};

// Get column key for a condition type (if applicable)
export { getColumnKeyForConditionType as getColumnKeyForCondition };

// Get available operators for a condition type
export const getOperatorsForConditionType = (conditionType) => {
  if (conditionType === CONDITION_TYPES.STATUS) {
    return Object.values(MULTI_SELECT_OPERATORS);
  }
  if (conditionType === CONDITION_TYPES.TAGS) {
    return AUTOMATION_TAG_OPERATORS;
  }
  if (isBooleanCondition(conditionType)) {
    return Object.values(BOOLEAN_OPERATORS);
  }
  if (isStringCondition(conditionType)) {
    return Object.values(STRING_OPERATORS);
  }
  if (isTimeBasedCondition(conditionType) || isTimestampBasedCondition(conditionType)) {
    return Object.values(COMPARISON_OPERATORS);
  }
  return Object.values(COMPARISON_OPERATORS);
};

// Get default operator for a condition type
export const getDefaultOperatorForConditionType = (conditionType) => {
  if (conditionType === CONDITION_TYPES.STATUS) {
    return MULTI_SELECT_OPERATORS.IS_ANY_OF;
  }
  if (conditionType === CONDITION_TYPES.TAGS) {
    return TAG_OPERATORS.IS_ANY_OF;
  }
  if (isBooleanCondition(conditionType)) {
    return BOOLEAN_OPERATORS.IS_TRUE;
  }
  if (isStringCondition(conditionType)) {
    return STRING_OPERATORS.CONTAINS;
  }
  // Default to GT for numeric/time conditions
  return COMPARISON_OPERATORS.GT;
};

// Get default value for a condition type
export const getDefaultValueForConditionType = (conditionType) => {
  if (conditionType === CONDITION_TYPES.STATUS) {
    return [];
  }
  if (conditionType === CONDITION_TYPES.TAGS) {
    return [];
  }
  if (isBooleanCondition(conditionType)) {
    return true;
  }
  if (isStringCondition(conditionType)) {
    return '';
  }
  // Default to 0 for numeric/time conditions
  return 0;
};

// Get condition type options for dropdown (built from shared filter field registry)
export const getConditionTypeOptions = (t, assetTypes = null) => {
  const allowedSet = assetTypes != null ? new Set(getSupportedConditions(assetTypes)) : null;

  const groups = getGroupedFilterFields('automation', {
    assetTypes,
    automationT: t,
  });

  if (!allowedSet) return groups;

  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((opt) => allowedSet.has(opt.value)),
    }))
    .filter((group) => group.options.length > 0);
};

// Flatten condition type options for simple dropdown
const getFlatConditionTypeOptions = (t, assetTypes = null) => {
  const grouped = getConditionTypeOptions(t, assetTypes);
  return grouped.flatMap((group) => group.options);
};

export { getFlatConditionTypeOptions };

export function getSupportedActionOptions(t, assetTypes) {
  const supported = new Set(getSupportedActions(assetTypes || ['torrent']));
  const all = [
    {
      value: ACTION_TYPES.STOP_SEEDING,
      label: t('actions.stopSeeding'),
      desc: t('actions.stopSeedingDescription'),
    },
    {
      value: ACTION_TYPES.ARCHIVE,
      label: t('actions.archive'),
      desc: t('actions.archiveDescription'),
    },
    {
      value: ACTION_TYPES.DELETE,
      label: t('actions.delete'),
      desc: t('actions.deleteDescription'),
    },
    {
      value: ACTION_TYPES.FORCE_START,
      label: t('actions.forceStart'),
      desc: t('actions.forceStartDescription'),
    },
    {
      value: ACTION_TYPES.ADD_TAG,
      label: t('actions.addTag'),
      desc: t('actions.addTagDescription'),
    },
    {
      value: ACTION_TYPES.REMOVE_TAG,
      label: t('actions.removeTag'),
      desc: t('actions.removeTagDescription'),
    },
    {
      value: ACTION_TYPES.ADD_AIRLOCK,
      label: t('actions.addAirlock'),
      desc: t('actions.addAirlockDescription'),
    },
    {
      value: ACTION_TYPES.REMOVE_AIRLOCK,
      label: t('actions.removeAirlock'),
      desc: t('actions.removeAirlockDescription'),
    },
  ];
  return all.filter((opt) => supported.has(opt.value));
}
