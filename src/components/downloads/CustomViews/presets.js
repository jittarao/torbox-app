import {
  BOOLEAN_OPERATORS,
  COMPARISON_OPERATORS,
  LOGIC_OPERATORS,
  MULTI_SELECT_OPERATORS,
  TAG_OPERATORS,
} from '../AutomationRules/constants';

const TEN_GB_MB = 10 * 1024;
const RECENT_DAYS = 7;
const EXPIRING_HOURS = RECENT_DAYS * 24;

function andFilter(filters) {
  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        filters,
      },
    ],
  };
}

function statusFilter(...values) {
  return andFilter([
    {
      column: 'download_state',
      operator: MULTI_SELECT_OPERATORS.IS_ANY_OF,
      value: values.flat(),
    },
  ]);
}

function booleanFilter(column) {
  return andFilter([
    {
      column,
      operator: BOOLEAN_OPERATORS.IS_TRUE,
      value: true,
    },
  ]);
}

/** @typedef {{ id: string, name: string, description: string, filters: object, asset_type?: string|null, sort?: { field: string, direction: string }|null }} ViewPreset */

/** @param {(key: string) => string} t */
export function createViewPresets(t) {
  return [
    {
      id: 'active',
      name: t('presets.active'),
      description: t('presets.activeDesc'),
      filters: statusFilter('downloading', 'seeding', 'uploading', 'stalled'),
    },
    {
      id: 'completed',
      name: t('presets.completed'),
      description: t('presets.completedDesc'),
      filters: statusFilter('completed'),
    },
    {
      id: 'dead',
      name: t('presets.dead'),
      description: t('presets.deadDesc'),
      filters: statusFilter('failed', 'inactive'),
    },
    {
      id: 'recentAdds',
      name: t('presets.recentAdds'),
      description: t('presets.recentAddsDesc'),
      filters: andFilter([
        {
          column: 'created_at',
          operator: COMPARISON_OPERATORS.LT,
          value: RECENT_DAYS,
        },
      ]),
      sort: { field: 'created_at', direction: 'desc' },
    },
    {
      id: 'largeFiles',
      name: t('presets.largeFiles'),
      description: t('presets.largeFilesDesc'),
      filters: andFilter([
        {
          column: 'size',
          operator: COMPARISON_OPERATORS.GT,
          value: TEN_GB_MB,
        },
      ]),
      sort: { field: 'size', direction: 'desc' },
    },
    {
      id: 'airlocked',
      name: t('presets.airlocked'),
      description: t('presets.airlockedDesc'),
      filters: andFilter([
        {
          column: 'airlocked',
          operator: BOOLEAN_OPERATORS.IS_TRUE,
          value: true,
        },
      ]),
    },
    {
      id: 'untagged',
      name: t('presets.untagged'),
      description: t('presets.untaggedDesc'),
      filters: andFilter([
        {
          column: 'tags',
          operator: TAG_OPERATORS.IS_NOT_SET,
          value: [],
        },
      ]),
    },
    {
      id: 'lowSeeds',
      name: t('presets.lowSeeds'),
      description: t('presets.lowSeedsDesc'),
      filters: andFilter([
        {
          column: 'seeds',
          operator: COMPARISON_OPERATORS.LT,
          value: 1,
        },
      ]),
      asset_type: 'torrents',
    },
    {
      id: 'cached',
      name: t('presets.cached'),
      description: t('presets.cachedDesc'),
      filters: booleanFilter('cached'),
    },
    {
      id: 'downloaded',
      name: t('presets.downloaded'),
      description: t('presets.downloadedDesc'),
      filters: booleanFilter('is_downloaded'),
    },
    {
      id: 'private',
      name: t('presets.private'),
      description: t('presets.privateDesc'),
      filters: booleanFilter('private'),
    },
    {
      id: 'expiring',
      name: t('presets.expiring'),
      description: t('presets.expiringDesc'),
      filters: andFilter([
        {
          column: 'expires_at',
          operator: COMPARISON_OPERATORS.LT,
          value: EXPIRING_HOURS,
        },
        {
          column: 'download_state',
          operator: MULTI_SELECT_OPERATORS.IS_ANY_OF,
          value: ['completed'],
        },
      ]),
      sort: { field: 'expires_at', direction: 'asc' },
    },
  ];
}

/** Deep-clone preset filters so editor mutations do not affect definitions. */
export function clonePresetFilters(preset) {
  return JSON.parse(JSON.stringify(preset.filters));
}
