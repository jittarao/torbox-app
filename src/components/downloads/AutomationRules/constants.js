export const TRIGGER_TYPES = {
  INTERVAL: 'interval',
};

export const CONDITION_TYPES = {
  // Lifecycle
  STATUS: 'STATUS',
  IS_ACTIVE: 'IS_ACTIVE',
  EXPIRES_AT: 'EXPIRES_AT',
  
  // Seeding
  SEEDING_ENABLED: 'SEEDING_ENABLED',
  RATIO: 'RATIO',
  SEEDING_TIME: 'SEEDING_TIME',
  SEEDS: 'SEEDS',
  PEERS: 'PEERS',
  LONG_TERM_SEEDING: 'LONG_TERM_SEEDING',
  LAST_UPLOAD_ACTIVITY_AT: 'LAST_UPLOAD_ACTIVITY_AT',
  TOTAL_UPLOADED: 'TOTAL_UPLOADED',
  UPLOAD_SPEED: 'UPLOAD_SPEED',
  AVG_UPLOAD_SPEED: 'AVG_UPLOAD_SPEED',
  
  // Downloading
  ETA: 'ETA',
  PROGRESS: 'PROGRESS',
  LAST_DOWNLOAD_ACTIVITY_AT: 'LAST_DOWNLOAD_ACTIVITY_AT',
  DOWNLOAD_SPEED: 'DOWNLOAD_SPEED',
  AVG_DOWNLOAD_SPEED: 'AVG_DOWNLOAD_SPEED',
  
  // Stall & Inactivity
  DOWNLOAD_STALLED_TIME: 'DOWNLOAD_STALLED_TIME',
  UPLOAD_STALLED_TIME: 'UPLOAD_STALLED_TIME',

  // Metadata
  AGE: 'AGE',
  TRACKER: 'TRACKER',
  AVAILABILITY: 'AVAILABILITY',
  FILE_SIZE: 'FILE_SIZE',
  FILE_COUNT: 'FILE_COUNT',
  NAME: 'NAME',
  PRIVATE: 'PRIVATE',
  CACHED: 'CACHED',
  ALLOW_ZIP: 'ALLOW_ZIP',
  
  // Tags
  TAGS: 'TAGS',
};

export const COMPARISON_OPERATORS = {
  GT: 'gt',
  LT: 'lt',
  GTE: 'gte',
  LTE: 'lte',
  EQ: 'eq',
};

export const MULTI_SELECT_OPERATORS = {
  IS_ANY_OF: 'is_any_of',
  IS_NONE_OF: 'is_none_of',
};

export const TAG_OPERATORS = {
  IS_ANY_OF: 'is_any_of',
  IS_ALL_OF: 'is_all_of',
  IS_NONE_OF: 'is_none_of',
};

export const BOOLEAN_OPERATORS = {
  IS_TRUE: 'is_true',
  IS_FALSE: 'is_false',
};

export const STRING_OPERATORS = {
  EQUALS: 'equals',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  NOT_EQUALS: 'not_equals',
  NOT_CONTAINS: 'not_contains',
};

export const LOGIC_OPERATORS = {
  AND: 'and',
  OR: 'or',
};

export const ACTION_TYPES = {
  STOP_SEEDING: 'stop_seeding',
  ARCHIVE: 'archive',
  DELETE: 'delete',
  FORCE_START: 'force_start',
  ADD_TAG: 'add_tag',
  REMOVE_TAG: 'remove_tag',
};

