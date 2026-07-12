import { CONDITION_TYPES } from '../AutomationRules/constants';

/** @typedef {'lifecycle'|'seeding'|'downloading'|'stalled'|'metadata'} FilterFieldGroup */

/** @typedef {'number'|'text'|'boolean'|'status'|'tags'|'time'|'timestamp'} FilterValueKind */

/**
 * @typedef {object} FilterFieldDef
 * @property {string} [conditionType] - Automation CONDITION_TYPES value
 * @property {string} columnKey - Custom view filter.column key
 * @property {FilterFieldGroup} group
 * @property {number} order - Sort order within group
 * @property {FilterValueKind} valueKind
 * @property {boolean} [torrentOnly]
 * @property {boolean} customView
 * @property {boolean} automation
 * @property {string} [labelKey] - i18n key under AutomationRules.conditions.*
 * @property {string} [descriptionKey]
 * @property {string} [customLabelKey] - Override label for CV-only fields
 * @property {string} [customDescriptionKey]
 * @property {string} [unit]
 * @property {'bytesToGb'|'bytesToMb'|'mbps'|'secondsToMinutes'|'percent'|'hoursSince'|'hoursUntil'|null} [valueConversion]
 * @property {string} [itemField] - Item property when different from columnKey
 */

/** @type {FilterFieldDef[]} */
export const FILTER_FIELD_DEFINITIONS = [
  // Lifecycle
  {
    conditionType: CONDITION_TYPES.STATUS,
    columnKey: 'download_state',
    group: 'lifecycle',
    order: 0,
    valueKind: 'status',
    customView: true,
    automation: true,
    labelKey: 'status',
    descriptionKey: 'statusDescription',
  },
  {
    conditionType: CONDITION_TYPES.IS_ACTIVE,
    columnKey: 'active',
    group: 'lifecycle',
    order: 1,
    valueKind: 'boolean',
    customView: true,
    automation: true,
    labelKey: 'isActive',
    descriptionKey: 'isActiveDescription',
    itemField: 'active',
  },
  {
    conditionType: CONDITION_TYPES.EXPIRES_AT,
    columnKey: 'expires_at',
    group: 'lifecycle',
    order: 2,
    valueKind: 'timestamp',
    customView: true,
    automation: true,
    labelKey: 'expiresAt',
    descriptionKey: 'expiresAtDescription',
    unit: 'hours until expiration',
    valueConversion: 'hoursUntil',
  },
  {
    columnKey: 'asset_type',
    group: 'lifecycle',
    order: 3,
    valueKind: 'status',
    customView: true,
    automation: false,
    customLabelKey: 'asset_type',
    customDescriptionKey: 'assetTypeDescription',
  },

  // Seeding
  {
    conditionType: CONDITION_TYPES.RATIO,
    columnKey: 'ratio',
    group: 'seeding',
    order: 0,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'seedingRatio',
    descriptionKey: 'seedingRatioDescription',
    unit: 'ratio',
  },
  {
    conditionType: CONDITION_TYPES.SEEDING_ENABLED,
    columnKey: 'seed_torrent',
    group: 'seeding',
    order: 1,
    valueKind: 'boolean',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'seedingEnabled',
    descriptionKey: 'seedingEnabledDescription',
  },
  {
    conditionType: CONDITION_TYPES.SEEDING_TIME,
    columnKey: 'seeding_time',
    group: 'seeding',
    order: 2,
    valueKind: 'time',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'seedingTime',
    descriptionKey: 'seedingTimeDescription',
    unit: 'hours',
    valueConversion: 'hoursSinceCached',
    itemField: 'cached_at',
  },
  {
    conditionType: CONDITION_TYPES.SEEDS,
    columnKey: 'seeds',
    group: 'seeding',
    order: 3,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'seeds',
    descriptionKey: 'seedsDescription',
    unit: 'count',
  },
  {
    conditionType: CONDITION_TYPES.PEERS,
    columnKey: 'peers',
    group: 'seeding',
    order: 4,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'peers',
    descriptionKey: 'peersDescription',
    unit: 'count',
  },
  {
    conditionType: CONDITION_TYPES.LONG_TERM_SEEDING,
    columnKey: 'long_term_seeding',
    group: 'seeding',
    order: 5,
    valueKind: 'boolean',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'longTermSeeding',
    descriptionKey: 'longTermSeedingDescription',
  },
  {
    conditionType: CONDITION_TYPES.LAST_UPLOAD_ACTIVITY_AT,
    columnKey: 'last_upload_activity_at',
    group: 'seeding',
    order: 6,
    valueKind: 'timestamp',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'lastUploadActivity',
    descriptionKey: 'lastUploadActivityDescription',
    unit: 'minutes ago',
  },
  {
    conditionType: CONDITION_TYPES.TOTAL_UPLOADED,
    columnKey: 'total_uploaded',
    group: 'seeding',
    order: 7,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'totalUploaded',
    descriptionKey: 'totalUploadedDescription',
    unit: 'GB',
    valueConversion: 'bytesToGb',
  },
  {
    conditionType: CONDITION_TYPES.UPLOAD_SPEED,
    columnKey: 'upload_speed',
    group: 'seeding',
    order: 8,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'uploadSpeed',
    descriptionKey: 'uploadSpeedDescription',
    unit: 'MB/s',
    valueConversion: 'mbps',
  },
  {
    conditionType: CONDITION_TYPES.AVG_UPLOAD_SPEED,
    columnKey: 'avg_upload_speed',
    group: 'seeding',
    order: 9,
    valueKind: 'number',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'avgUploadSpeed',
    descriptionKey: 'avgUploadSpeedDescription',
    unit: 'MB/s',
  },

  // Downloading
  {
    conditionType: CONDITION_TYPES.ETA,
    columnKey: 'eta',
    group: 'downloading',
    order: 0,
    valueKind: 'number',
    customView: true,
    automation: true,
    labelKey: 'eta',
    descriptionKey: 'etaDescription',
    unit: 'minutes',
    valueConversion: 'secondsToMinutes',
  },
  {
    conditionType: CONDITION_TYPES.PROGRESS,
    columnKey: 'progress',
    group: 'downloading',
    order: 1,
    valueKind: 'number',
    customView: true,
    automation: true,
    labelKey: 'progress',
    descriptionKey: 'progressDescription',
    unit: '%',
    valueConversion: 'percent',
  },
  {
    conditionType: CONDITION_TYPES.LAST_DOWNLOAD_ACTIVITY_AT,
    columnKey: 'last_download_activity_at',
    group: 'downloading',
    order: 2,
    valueKind: 'timestamp',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'lastDownloadActivity',
    descriptionKey: 'lastDownloadActivityDescription',
    unit: 'minutes ago',
  },
  {
    conditionType: CONDITION_TYPES.DOWNLOAD_SPEED,
    columnKey: 'download_speed',
    group: 'downloading',
    order: 3,
    valueKind: 'number',
    customView: true,
    automation: true,
    labelKey: 'downloadSpeed',
    descriptionKey: 'downloadSpeedDescription',
    unit: 'MB/s',
    valueConversion: 'mbps',
  },
  {
    conditionType: CONDITION_TYPES.AVG_DOWNLOAD_SPEED,
    columnKey: 'avg_download_speed',
    group: 'downloading',
    order: 4,
    valueKind: 'number',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'avgDownloadSpeed',
    descriptionKey: 'avgDownloadSpeedDescription',
    unit: 'MB/s',
  },
  {
    conditionType: CONDITION_TYPES.TOTAL_DOWNLOADED,
    columnKey: 'total_downloaded',
    group: 'downloading',
    order: 5,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'totalDownloaded',
    descriptionKey: 'totalDownloadedDescription',
    unit: 'MB',
    valueConversion: 'bytesToMb',
  },

  // Stalled (automation only)
  {
    conditionType: CONDITION_TYPES.DOWNLOAD_STALLED_TIME,
    columnKey: 'download_stalled_time',
    group: 'stalled',
    order: 0,
    valueKind: 'time',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'downloadStalledTime',
    descriptionKey: 'downloadStalledTimeDescription',
    unit: 'minutes',
  },
  {
    conditionType: CONDITION_TYPES.UPLOAD_STALLED_TIME,
    columnKey: 'upload_stalled_time',
    group: 'stalled',
    order: 1,
    valueKind: 'time',
    torrentOnly: true,
    customView: false,
    automation: true,
    labelKey: 'uploadStalledTime',
    descriptionKey: 'uploadStalledTimeDescription',
    unit: 'minutes',
  },

  // Metadata
  {
    conditionType: CONDITION_TYPES.AGE,
    columnKey: 'age',
    group: 'metadata',
    order: 0,
    valueKind: 'time',
    customView: true,
    automation: true,
    labelKey: 'age',
    descriptionKey: 'ageDescription',
    unit: 'hours',
    valueConversion: 'hoursSinceCreated',
    itemField: 'created_at',
  },
  {
    conditionType: CONDITION_TYPES.TRACKER,
    columnKey: 'tracker',
    group: 'metadata',
    order: 1,
    valueKind: 'text',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'tracker',
    descriptionKey: 'trackerDescription',
  },
  {
    conditionType: CONDITION_TYPES.AVAILABILITY,
    columnKey: 'availability',
    group: 'metadata',
    order: 2,
    valueKind: 'number',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'availability',
    descriptionKey: 'availabilityDescription',
  },
  {
    conditionType: CONDITION_TYPES.FILE_SIZE,
    columnKey: 'size',
    group: 'metadata',
    order: 3,
    valueKind: 'number',
    customView: true,
    automation: true,
    labelKey: 'fileSize',
    descriptionKey: 'fileSizeDescription',
    unit: 'GB',
    valueConversion: 'bytesToGb',
  },
  {
    conditionType: CONDITION_TYPES.FILE_COUNT,
    columnKey: 'file_count',
    group: 'metadata',
    order: 4,
    valueKind: 'number',
    customView: true,
    automation: true,
    labelKey: 'fileCount',
    descriptionKey: 'fileCountDescription',
    unit: 'count',
  },
  {
    conditionType: CONDITION_TYPES.NAME,
    columnKey: 'name',
    group: 'metadata',
    order: 5,
    valueKind: 'text',
    customView: true,
    automation: true,
    labelKey: 'name',
    descriptionKey: 'nameDescription',
  },
  {
    conditionType: CONDITION_TYPES.ORIGINAL_URL,
    columnKey: 'original_url',
    group: 'metadata',
    order: 6,
    valueKind: 'text',
    customView: true,
    automation: true,
    labelKey: 'originalUrl',
    descriptionKey: 'originalUrlDescription',
  },
  {
    conditionType: CONDITION_TYPES.PRIVATE,
    columnKey: 'private',
    group: 'metadata',
    order: 7,
    valueKind: 'boolean',
    torrentOnly: true,
    customView: true,
    automation: true,
    labelKey: 'private',
    descriptionKey: 'privateDescription',
  },
  {
    conditionType: CONDITION_TYPES.CACHED,
    columnKey: 'cached',
    group: 'metadata',
    order: 8,
    valueKind: 'boolean',
    customView: true,
    automation: true,
    labelKey: 'cached',
    descriptionKey: 'cachedDescription',
  },
  {
    conditionType: CONDITION_TYPES.ALLOW_ZIP,
    columnKey: 'allow_zip',
    group: 'metadata',
    order: 9,
    valueKind: 'boolean',
    customView: true,
    automation: true,
    labelKey: 'allowZip',
    descriptionKey: 'allowZipDescription',
  },
  {
    conditionType: CONDITION_TYPES.IS_AIRLOCKED,
    columnKey: 'airlocked',
    group: 'metadata',
    order: 10,
    valueKind: 'boolean',
    customView: true,
    automation: true,
    labelKey: 'isAirlocked',
    descriptionKey: 'isAirlockedDescription',
  },
  {
    columnKey: 'is_downloaded',
    group: 'metadata',
    order: 11,
    valueKind: 'boolean',
    customView: true,
    automation: false,
    customLabelKey: 'is_downloaded',
    customDescriptionKey: 'isDownloadedDescription',
  },
  {
    columnKey: 'is_protected',
    group: 'metadata',
    order: 12,
    valueKind: 'boolean',
    customView: true,
    automation: false,
    customLabelKey: 'is_protected_filter',
    customDescriptionKey: 'isProtectedDescription',
  },
  {
    conditionType: CONDITION_TYPES.TAGS,
    columnKey: 'tags',
    group: 'metadata',
    order: 13,
    valueKind: 'tags',
    customView: true,
    automation: true,
    labelKey: 'tags',
    descriptionKey: 'tagsDescription',
  },
];

const GROUP_ORDER = ['lifecycle', 'seeding', 'downloading', 'stalled', 'metadata'];

const columnKeyToDef = new Map();
const conditionTypeToDef = new Map();

for (const def of FILTER_FIELD_DEFINITIONS) {
  columnKeyToDef.set(def.columnKey, def);
  if (def.conditionType) {
    conditionTypeToDef.set(def.conditionType, def);
  }
}

/** Legacy column keys migrated to canonical keys. */
export const LEGACY_COLUMN_MIGRATIONS = {
  created_at: 'age',
  cached_at: 'seeding_time',
};

/**
 * @param {string} columnKey
 * @returns {FilterFieldDef|undefined}
 */
export function getFieldByColumnKey(columnKey) {
  return columnKeyToDef.get(columnKey);
}

/**
 * @param {string} conditionType
 * @returns {FilterFieldDef|undefined}
 */
export function getFieldByConditionType(conditionType) {
  return conditionTypeToDef.get(conditionType);
}

/**
 * @param {string} conditionType
 * @returns {string|null}
 */
export function getColumnKeyForConditionType(conditionType) {
  return getFieldByConditionType(conditionType)?.columnKey ?? null;
}

/**
 * @param {string} columnKey
 * @returns {string|null}
 */
export function getConditionTypeForColumnKey(columnKey) {
  return getFieldByColumnKey(columnKey)?.conditionType ?? null;
}

/**
 * @param {string} activeType - downloads tab: 'all' | 'torrents' | 'usenet' | 'webdl'
 */
function isFieldVisibleForAssetType(def, activeType) {
  if (!def.torrentOnly) return true;
  if (!activeType || activeType === 'all') return true;
  return activeType === 'torrents';
}

/**
 * @param {string[]|null} assetTypes - automation rule asset types (singular: torrent, usenet, webdl)
 */
function isFieldVisibleForAssetTypes(def, assetTypes) {
  if (!assetTypes || assetTypes.length === 0) return true;
  if (!def.torrentOnly) return true;
  return assetTypes.includes('torrent');
}

/**
 * @param {'customView'|'automation'} surface
 * @param {object} [options]
 * @param {string} [options.activeType]
 * @param {string[]|null} [options.assetTypes]
 * @param {(key: string) => string} [options.automationT] - AutomationRules translator
 * @param {(key: string) => string} [options.columnT] - Downloads.columns translator
 * @param {(key: string) => string} [options.customViewsT]
 * @returns {{ label: string, options: { value: string, label: string, description?: string }[] }[]}
 */
export function getGroupedFilterFields(surface, options = {}) {
  const { activeType, assetTypes, automationT, columnT, customViewsT } = options;

  const visibleDefs = FILTER_FIELD_DEFINITIONS.filter((def) => {
    if (surface === 'customView' && !def.customView) return false;
    if (surface === 'automation' && !def.automation) return false;
    if (surface === 'customView') return isFieldVisibleForAssetType(def, activeType);
    return isFieldVisibleForAssetTypes(def, assetTypes);
  });

  const grouped = new Map();
  for (const def of visibleDefs) {
    if (!grouped.has(def.group)) grouped.set(def.group, []);
    grouped.get(def.group).push(def);
  }

  return GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => {
    const defs = grouped.get(group).sort((a, b) => a.order - b.order);
    const groupLabelKey = `conditionGroups.${group}`;
    const label =
      automationT?.(groupLabelKey) ??
      customViewsT?.(`columnGroups.${group}`) ??
      group.charAt(0).toUpperCase() + group.slice(1);

    const optionsList = defs.map((def) => {
      let fieldLabel;
      let description;

      if (def.labelKey && automationT) {
        fieldLabel = automationT(`conditions.${def.labelKey}`);
        description = def.descriptionKey
          ? automationT(`conditions.${def.descriptionKey}`)
          : undefined;
      } else if (def.customLabelKey) {
        if (def.customLabelKey === 'is_protected_filter' && columnT) {
          fieldLabel = columnT('is_protected_filter');
        } else if (def.customLabelKey === 'is_downloaded' && columnT) {
          fieldLabel = columnT('is_downloaded');
        } else if (def.customLabelKey === 'asset_type' && columnT) {
          fieldLabel = columnT('asset_type');
        } else {
          fieldLabel = def.customLabelKey;
        }
        description = def.customDescriptionKey
          ? customViewsT?.(def.customDescriptionKey)
          : undefined;
      } else {
        fieldLabel = def.columnKey;
      }

      const value =
        surface === 'automation' && def.conditionType ? def.conditionType : def.columnKey;

      return { value, label: fieldLabel, description };
    });

    return { label, options: optionsList };
  });
}

/**
 * @param {string} columnKey
 * @returns {string}
 */
export function getColumnUnit(columnKey) {
  return getFieldByColumnKey(columnKey)?.unit ?? '';
}

/**
 * @param {string} conditionType
 * @returns {string}
 */
export function getConditionUnitFromRegistry(conditionType) {
  return getFieldByConditionType(conditionType)?.unit ?? '';
}

/**
 * @param {string} columnKey
 * @returns {FilterValueKind}
 */
export function getColumnValueKind(columnKey) {
  return getFieldByColumnKey(columnKey)?.valueKind ?? 'number';
}

/**
 * @param {string} conditionType
 * @returns {FilterValueKind}
 */
export function getConditionValueKind(conditionType) {
  return getFieldByConditionType(conditionType)?.valueKind ?? 'number';
}

/**
 * Resolve item property for filter evaluation.
 * @param {string} columnKey
 * @returns {string}
 */
export function getItemFieldForColumn(columnKey) {
  const def = getFieldByColumnKey(columnKey);
  return def?.itemField ?? def?.columnKey ?? columnKey;
}

/**
 * @param {string} columnKey
 * @returns {'bytesToGb'|'bytesToMb'|'mbps'|'secondsToMinutes'|'percent'|'hoursSinceCreated'|'hoursSinceCached'|'hoursUntil'|null}
 */
export function getValueConversion(columnKey) {
  return getFieldByColumnKey(columnKey)?.valueConversion ?? null;
}

export { GROUP_ORDER };
