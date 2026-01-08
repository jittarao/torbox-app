import { CONDITION_TYPES, LOGIC_OPERATORS } from './constants';

// Helper to check if a condition type is time-based (relative duration)
export const isTimeBasedCondition = (conditionType) => {
  return [
    CONDITION_TYPES.SEEDING_TIME,
    CONDITION_TYPES.AGE,
    CONDITION_TYPES.DOWNLOAD_STALLED_TIME,
    CONDITION_TYPES.UPLOAD_STALLED_TIME,
  ].includes(conditionType);
};

// Helper to check if a condition type is timestamp-based (absolute time)
export const isTimestampBasedCondition = (conditionType) => {
  return [
    CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT,
    CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT,
    CONDITION_TYPES.EXPIRES_AT,
  ].includes(conditionType);
};

// Helper to check if a condition type is boolean-based
export const isBooleanCondition = (conditionType) => {
  return [
    CONDITION_TYPES.IS_ACTIVE,
    CONDITION_TYPES.SEEDING_ENABLED,
    CONDITION_TYPES.LONG_TERM_SEEDING,
    CONDITION_TYPES.PRIVATE,
    CONDITION_TYPES.CACHED,
    CONDITION_TYPES.ALLOW_ZIP,
  ].includes(conditionType);
};

// Helper to check if a condition type is string-based
export const isStringCondition = (conditionType) => {
  return [
    CONDITION_TYPES.TRACKER,
    CONDITION_TYPES.NAME,
  ].includes(conditionType);
};

// Helper to check if a condition type requires hours parameter
export const isSpeedAverageCondition = (conditionType) => {
  return [
    CONDITION_TYPES.AVG_DOWNLOAD_SPEED,
    CONDITION_TYPES.AVG_UPLOAD_SPEED,
  ].includes(conditionType);
};

export const getConditionText = (conditions, logicOperator, t, commonT) => {
  const conditionTexts = conditions.map((condition) => {
    const operator = condition.operator;
    const isTimeBased = isTimeBasedCondition(condition.type);
    const isTimestampBased = isTimestampBasedCondition(condition.type);
    const timeOpT = isTimeBased ? t(`timeOperators.${operator}`) : null;
    const timestampOpT = isTimestampBased ? t(`timestampOperators.${operator}`) : null;
    const numOpT = (!isTimeBased && !isTimestampBased) ? t(`operators.${operator}`) : null;

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
      return `total uploaded ${numOpT} ${condition.value} MB`;
    }
    // Content & Metadata (numeric)
    else if (condition.type === CONDITION_TYPES.FILE_SIZE) {
      return `file size ${numOpT} ${condition.value} MB`;
    } else if (condition.type === CONDITION_TYPES.FILE_COUNT) {
      return `file count ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.NAME) {
      return `name contains "${condition.value}"`;
    } else if (condition.type === CONDITION_TYPES.PRIVATE) {
      const isPrivate = condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isPrivate ? 'private' : 'public'}`;
    } else if (condition.type === CONDITION_TYPES.CACHED) {
      const isCached = condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isCached ? 'cached' : 'not cached'}`;
    } else if (condition.type === CONDITION_TYPES.AVAILABILITY) {
      return `availability ${numOpT} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.ALLOW_ZIP) {
      const allowZip = condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${allowZip ? 'zip allowed' : 'zip not allowed'}`;
    }
    // Lifecycle
    else if (condition.type === CONDITION_TYPES.IS_ACTIVE) {
      const isActive = condition.value === true || condition.value === 1 || condition.value === 'true';
      return `is ${isActive ? 'active' : 'inactive'}`;
    } else if (condition.type === CONDITION_TYPES.SEEDING_ENABLED) {
      const seedingEnabled = condition.value === true || condition.value === 1 || condition.value === 'true';
      return `seeding is ${seedingEnabled ? 'enabled' : 'disabled'}`;
    } else if (condition.type === CONDITION_TYPES.LONG_TERM_SEEDING) {
      const longTermSeeding = condition.value === true || condition.value === 1 || condition.value === 'true';
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
    } else if (condition.type === CONDITION_TYPES.EXPIRES_AT) {
      if (operator === 'lt' || operator === 'lte') {
        return `expires within ${condition.value} hours`;
      } else if (operator === 'gt' || operator === 'gte') {
        return `expires in ${timestampOpT} ${condition.value} hours`;
      } else {
        return `expires in ${timestampOpT} ${condition.value} hours`;
      }
    }
    
    return '';
  });

  const logicText = logicOperator === LOGIC_OPERATORS.AND ? ' AND ' : ' OR ';
  return conditionTexts.join(logicText);
};

export const getConditionUnit = (conditionType) => {
  if (conditionType === CONDITION_TYPES.SEEDING_TIME || conditionType === CONDITION_TYPES.AGE) {
    return 'hours';
  } else if (conditionType === CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT || 
             conditionType === CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT) {
    return 'minutes ago';
  } else if (conditionType === CONDITION_TYPES.DOWNLOAD_STALLED_TIME ||
             conditionType === CONDITION_TYPES.UPLOAD_STALLED_TIME) {
    return 'minutes';
  } else if (conditionType === CONDITION_TYPES.PROGRESS) {
    return '%';
  } else if (conditionType === CONDITION_TYPES.DOWNLOAD_SPEED ||
             conditionType === CONDITION_TYPES.AVG_DOWNLOAD_SPEED) {
    return 'MB/s';
  } else if (conditionType === CONDITION_TYPES.UPLOAD_SPEED ||
             conditionType === CONDITION_TYPES.AVG_UPLOAD_SPEED) {
    return 'MB/s';
  } else if (conditionType === CONDITION_TYPES.ETA) {
    return 'minutes';
  } else if (conditionType === CONDITION_TYPES.SEEDS || 
             conditionType === CONDITION_TYPES.PEERS ||
             conditionType === CONDITION_TYPES.FILE_COUNT) {
    return 'count';
  } else if (conditionType === CONDITION_TYPES.RATIO) {
    return 'ratio';
  } else if (conditionType === CONDITION_TYPES.FILE_SIZE ||
             conditionType === CONDITION_TYPES.TOTAL_UPLOADED) {
    return 'GB';
  } else if (conditionType === CONDITION_TYPES.STATUS ||
             conditionType === CONDITION_TYPES.NAME ||
             conditionType === CONDITION_TYPES.PRIVATE ||
             conditionType === CONDITION_TYPES.CACHED ||
             conditionType === CONDITION_TYPES.IS_ACTIVE ||
             conditionType === CONDITION_TYPES.SEEDING_ENABLED ||
             conditionType === CONDITION_TYPES.ALLOW_ZIP ||
             conditionType === CONDITION_TYPES.LONG_TERM_SEEDING) {
    return '';
  } else if (conditionType === CONDITION_TYPES.AVAILABILITY) {
    return '';
  } else if (conditionType === CONDITION_TYPES.EXPIRES_AT) {
    return 'hours until expiration';
  }
  return '';
};

