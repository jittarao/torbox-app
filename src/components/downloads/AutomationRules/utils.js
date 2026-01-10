import { 
  CONDITION_TYPES, 
  LOGIC_OPERATORS,
  COMPARISON_OPERATORS,
  MULTI_SELECT_OPERATORS,
  BOOLEAN_OPERATORS,
  STRING_OPERATORS,
} from './constants';

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

// Map condition types to column keys where applicable (for reference only)
export const CONDITION_TO_COLUMN_MAP = {
  [CONDITION_TYPES.PROGRESS]: 'progress',
  [CONDITION_TYPES.RATIO]: 'ratio',
  [CONDITION_TYPES.SEEDS]: 'seeds',
  [CONDITION_TYPES.PEERS]: 'peers',
  [CONDITION_TYPES.FILE_SIZE]: 'size',
  [CONDITION_TYPES.FILE_COUNT]: 'file_count',
  [CONDITION_TYPES.NAME]: 'name',
  [CONDITION_TYPES.TRACKER]: 'tracker',
  [CONDITION_TYPES.PRIVATE]: 'private',
  [CONDITION_TYPES.STATUS]: 'download_state',
  [CONDITION_TYPES.DOWNLOAD_SPEED]: 'download_speed',
  [CONDITION_TYPES.UPLOAD_SPEED]: 'upload_speed',
  [CONDITION_TYPES.TOTAL_UPLOADED]: 'total_uploaded',
  [CONDITION_TYPES.TOTAL_DOWNLOADED]: 'total_downloaded',
  [CONDITION_TYPES.EXPIRES_AT]: 'expires_at',
};

// Get column key for a condition type (if applicable)
export const getColumnKeyForCondition = (conditionType) => {
  return CONDITION_TO_COLUMN_MAP[conditionType] || null;
};

// Get condition type filter category (number, text, boolean, status, time, timestamp)
export const getConditionTypeCategory = (conditionType) => {
  if (isBooleanCondition(conditionType)) {
    return 'boolean';
  }
  if (isStringCondition(conditionType)) {
    return 'text';
  }
  if (conditionType === CONDITION_TYPES.STATUS) {
    return 'status';
  }
  if (isTimeBasedCondition(conditionType)) {
    return 'time';
  }
  if (isTimestampBasedCondition(conditionType)) {
    return 'timestamp';
  }
  // Default to number for numeric conditions
  return 'number';
};

// Get available operators for a condition type
export const getOperatorsForConditionType = (conditionType) => {
  if (conditionType === CONDITION_TYPES.STATUS) {
    return Object.values(MULTI_SELECT_OPERATORS);
  }
  if (isBooleanCondition(conditionType)) {
    return Object.values(BOOLEAN_OPERATORS);
  }
  if (isStringCondition(conditionType)) {
    return Object.values(STRING_OPERATORS);
  }
  // All other conditions use comparison operators
  return Object.values(COMPARISON_OPERATORS);
};

// Get default operator for a condition type
export const getDefaultOperatorForConditionType = (conditionType) => {
  if (conditionType === CONDITION_TYPES.STATUS) {
    return MULTI_SELECT_OPERATORS.IS_ANY_OF;
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
  if (isBooleanCondition(conditionType)) {
    return true;
  }
  if (isStringCondition(conditionType)) {
    return '';
  }
  // Default to 0 for numeric/time conditions
  return 0;
};

// Get condition type options for dropdown (similar to getFilterableColumns)
// Accepts translation function `t` as parameter
export const getConditionTypeOptions = (t) => {
  return [
    {
      label: t('conditionGroups.lifecycle'),
      options: [
        { value: CONDITION_TYPES.STATUS, label: t('conditions.status'), description: t('conditions.statusDescription') },
        { value: CONDITION_TYPES.IS_ACTIVE, label: t('conditions.isActive'), description: t('conditions.isActiveDescription') },
        { value: CONDITION_TYPES.EXPIRES_AT, label: t('conditions.expiresAt'), description: t('conditions.expiresAtDescription') },
      ],
    },
    {
      label: t('conditionGroups.seeding'),
      options: [
        { value: CONDITION_TYPES.RATIO, label: t('conditions.seedingRatio'), description: t('conditions.seedingRatioDescription') },
        { value: CONDITION_TYPES.SEEDING_ENABLED, label: t('conditions.seedingEnabled'), description: t('conditions.seedingEnabledDescription') },
        { value: CONDITION_TYPES.SEEDING_TIME, label: t('conditions.seedingTime'), description: t('conditions.seedingTimeDescription') },
        { value: CONDITION_TYPES.SEEDS, label: t('conditions.seeds'), description: t('conditions.seedsDescription') },
        { value: CONDITION_TYPES.PEERS, label: t('conditions.peers'), description: t('conditions.peersDescription') },
        { value: CONDITION_TYPES.LONG_TERM_SEEDING, label: t('conditions.longTermSeeding'), description: t('conditions.longTermSeedingDescription') },
        { value: CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT, label: t('conditions.lastUploadActivity'), description: t('conditions.lastUploadActivityDescription') },
        { value: CONDITION_TYPES.TOTAL_UPLOADED, label: t('conditions.totalUploaded'), description: t('conditions.totalUploadedDescription') },
        { value: CONDITION_TYPES.UPLOAD_SPEED, label: t('conditions.uploadSpeed'), description: t('conditions.uploadSpeedDescription') },
        { value: CONDITION_TYPES.AVG_UPLOAD_SPEED, label: t('conditions.avgUploadSpeed'), description: t('conditions.avgUploadSpeedDescription') },
      ],
    },
    {
      label: t('conditionGroups.downloading'),
      options: [
        { value: CONDITION_TYPES.ETA, label: t('conditions.eta'), description: t('conditions.etaDescription') },
        { value: CONDITION_TYPES.PROGRESS, label: t('conditions.progress'), description: t('conditions.progressDescription') },
        { value: CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT, label: t('conditions.lastDownloadActivity'), description: t('conditions.lastDownloadActivityDescription') },
        { value: CONDITION_TYPES.DOWNLOAD_SPEED, label: t('conditions.downloadSpeed'), description: t('conditions.downloadSpeedDescription') },
        { value: CONDITION_TYPES.AVG_DOWNLOAD_SPEED, label: t('conditions.avgDownloadSpeed'), description: t('conditions.avgDownloadSpeedDescription') },
      ],
    },
    {
      label: t('conditionGroups.stalled'),
      options: [
        { value: CONDITION_TYPES.DOWNLOAD_STALLED_TIME, label: t('conditions.downloadStalledTime'), description: t('conditions.downloadStalledTimeDescription') },
        { value: CONDITION_TYPES.UPLOAD_STALLED_TIME, label: t('conditions.uploadStalledTime'), description: t('conditions.uploadStalledTimeDescription') },
      ],
    },
    {
      label: t('conditionGroups.metadata'),
      options: [
        { value: CONDITION_TYPES.AGE, label: t('conditions.age'), description: t('conditions.ageDescription') },
        { value: CONDITION_TYPES.TRACKER, label: t('conditions.tracker'), description: t('conditions.trackerDescription') },
        { value: CONDITION_TYPES.AVAILABILITY, label: t('conditions.availability'), description: t('conditions.availabilityDescription') },
        { value: CONDITION_TYPES.FILE_SIZE, label: t('conditions.fileSize'), description: t('conditions.fileSizeDescription') },
        { value: CONDITION_TYPES.FILE_COUNT, label: t('conditions.fileCount'), description: t('conditions.fileCountDescription') },
        { value: CONDITION_TYPES.NAME, label: t('conditions.name'), description: t('conditions.nameDescription') },
        { value: CONDITION_TYPES.PRIVATE, label: t('conditions.private'), description: t('conditions.privateDescription') },
        { value: CONDITION_TYPES.CACHED, label: t('conditions.cached'), description: t('conditions.cachedDescription') },
        { value: CONDITION_TYPES.ALLOW_ZIP, label: t('conditions.allowZip'), description: t('conditions.allowZipDescription') },
      ],
    },
  ];
};

// Flatten condition type options for simple dropdown
export const getFlatConditionTypeOptions = (t) => {
  const grouped = getConditionTypeOptions(t);
  return grouped.flatMap(group => group.options);
};

