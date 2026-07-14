import {
  LOGIC_OPERATORS,
  MULTI_SELECT_OPERATORS,
  STRING_OPERATORS,
  TAG_OPERATORS,
} from '../AutomationRules/constants';
import { COMBINE_MODES, isAllCombineMode } from './sidebarCombineMode';
import { isTagsColumn } from '../CustomViews/utils';
import { LEGACY_COLUMN_MIGRATIONS } from './filterFieldRegistry';
import { itemMatchesFilters } from './filterEvaluation';
import { itemMatchesDownloadSearch } from '../utils/downloadSearch';

export const EMPTY_FILTERS = {
  logicOperator: LOGIC_OPERATORS.AND,
  groups: [
    {
      logicOperator: LOGIC_OPERATORS.AND,
      filters: [],
    },
  ],
};

const EMPTY_FILTERS_JSON = JSON.stringify(EMPTY_FILTERS);

export const FILTER_SCHEMA_VERSION = 2;

/** Legacy custom views stored file size in MB; values at or above this are converted to GB. */
const LEGACY_SIZE_MB_THRESHOLD = 512;

let migrationWarningLogged = false;

/**
 * Migrate legacy custom view filter columns/units to automation-aligned format.
 * @param {object} filter - Single filter rule
 * @returns {object} Migrated filter
 */
function migrateFilterRule(filter) {
  if (!filter?.column) return filter;

  const migrated = { ...filter };

  const legacyTarget = LEGACY_COLUMN_MIGRATIONS[filter.column];
  if (legacyTarget) {
    migrated.column = legacyTarget;

    if (filter.column === 'created_at' || filter.column === 'cached_at') {
      const days = typeof filter.value === 'number' ? filter.value : parseFloat(filter.value) || 0;
      migrated.value = days * 24;
    }
  }

  if (filter.column === 'size' || filter.column === 'total_uploaded') {
    const raw = typeof filter.value === 'number' ? filter.value : parseFloat(filter.value) || 0;
    if (raw >= LEGACY_SIZE_MB_THRESHOLD) {
      migrated.value = raw / 1024;
    }
  }

  if (filter.column === 'eta' && typeof filter.value === 'number' && filter.value > 180) {
    migrated.value = filter.value / 60;
  }

  return migrated;
}

/**
 * Migrate all filters in a normalized filter structure.
 * @param {object} filters
 * @returns {object}
 */
export function migrateCustomViewFilters(filters) {
  if (!filters?.groups) return filters;
  if (filters._filterSchemaVersion >= FILTER_SCHEMA_VERSION) return filters;

  const migrated = {
    ...filters,
    _filterSchemaVersion: FILTER_SCHEMA_VERSION,
    groups: filters.groups.map((group) => ({
      ...group,
      filters: (group.filters || []).map(migrateFilterRule),
    })),
  };

  if (!migrationWarningLogged && typeof console !== 'undefined') {
    migrationWarningLogged = true;
    console.info(
      '[CustomViews] Migrated saved filter rules to automation-aligned columns and units.'
    );
  }

  return migrated;
}

/**
 * Normalize raw filters to the standard group structure without legacy unit migration.
 */
export function normalizeFilterStructure(raw) {
  let filters = raw;

  if (typeof filters === 'string') {
    try {
      filters = JSON.parse(filters);
    } catch {
      return JSON.parse(EMPTY_FILTERS_JSON);
    }
  }

  if (!filters) {
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  if (filters.groups && Array.isArray(filters.groups)) {
    return JSON.parse(JSON.stringify(filters));
  }

  if (Array.isArray(filters)) {
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

  return JSON.parse(JSON.stringify(EMPTY_FILTERS));
}

/**
 * Mark editor/saved filters as current schema so legacy MB→GB migration does not re-run.
 */
export function stampFilterSchemaVersion(raw) {
  const structured = normalizeFilterStructure(raw);
  return {
    ...structured,
    _filterSchemaVersion: FILTER_SCHEMA_VERSION,
  };
}

/**
 * Normalize raw filters (string JSON, flat array, or group structure) to standard group format.
 */
export function normalizeFilters(raw) {
  return migrateCustomViewFilters(normalizeFilterStructure(raw));
}

/**
 * @param {object|string|undefined} options — `{ combineMode }` or legacy operator string
 * @returns {'any'|'all'}
 */
function resolveCombineMode(options) {
  if (options == null) return COMBINE_MODES.ANY;
  if (typeof options === 'object' && options.combineMode) {
    return isAllCombineMode(options.combineMode) ? COMBINE_MODES.ALL : COMBINE_MODES.ANY;
  }
  return COMBINE_MODES.ANY;
}

/**
 * Build a filter structure that matches downloads with any or all of the given tag IDs.
 * @param {number|number[]} tagIds
 * @param {{ combineMode?: 'any'|'all' }|string} [options] — combineMode or legacy operator string
 */
export function buildTagFilter(tagIds, options) {
  const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
  let operator = MULTI_SELECT_OPERATORS.IS_ANY_OF;
  if (typeof options === 'string') {
    operator = options;
  } else {
    const combineMode = resolveCombineMode(options);
    operator = isAllCombineMode(combineMode)
      ? TAG_OPERATORS.IS_ALL_OF
      : MULTI_SELECT_OPERATORS.IS_ANY_OF;
  }
  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.AND,
        filters: [
          {
            column: 'tags',
            operator,
            value: ids,
          },
        ],
      },
    ],
  };
}

/**
 * Count conditions that have a column set (active filter rules).
 */
export function countActiveConditions(filters) {
  if (!filters) return 0;

  const groups = filters.groups ? filters.groups : Array.isArray(filters) ? [{ filters }] : [];

  return groups.reduce(
    (count, group) => count + (group.filters?.filter((f) => f.column).length || 0),
    0
  );
}

/**
 * Whether any filter conditions are configured.
 */
export function hasActiveFilters(filters) {
  return countActiveConditions(filters) > 0;
}

const TAG_SIDEBAR_OPERATORS = new Set([
  MULTI_SELECT_OPERATORS.IS_ANY_OF,
  TAG_OPERATORS.IS_ANY_OF,
  TAG_OPERATORS.IS_ALL_OF,
]);

/**
 * True when filters are exclusively a single sidebar tag rule (IS_ANY_OF or IS_ALL_OF).
 */
export function isTagOnlyFilter(filters) {
  const count = countActiveConditions(filters);
  if (count !== 1) return false;

  const groups = filters?.groups || [];
  for (const group of groups) {
    for (const f of group.filters || []) {
      if (!f.column) continue;
      if (!isTagsColumn(f.column)) return false;
      if (!TAG_SIDEBAR_OPERATORS.has(f.operator)) return false;
      if (!Array.isArray(f.value) || f.value.length === 0) return false;
    }
  }
  return true;
}

/**
 * @param {object} filters
 * @returns {'any'|'all'}
 */
export function getTagCombineMode(filters) {
  if (!isTagOnlyFilter(filters)) return COMBINE_MODES.ANY;
  for (const group of filters.groups || []) {
    for (const f of group.filters || []) {
      if (isTagsColumn(f.column) && f.operator === TAG_OPERATORS.IS_ALL_OF) {
        return COMBINE_MODES.ALL;
      }
    }
  }
  return COMBINE_MODES.ANY;
}

/**
 * Extract active tag IDs when filters are tag-only; otherwise null.
 */
export function getActiveTagIds(filters) {
  if (!isTagOnlyFilter(filters)) return null;

  const tagIds = [];
  for (const group of filters.groups || []) {
    for (const f of group.filters || []) {
      if (isTagsColumn(f.column) && Array.isArray(f.value)) {
        tagIds.push(...f.value.map((id) => Number(id)));
      }
    }
  }
  return tagIds.length > 0 ? tagIds : null;
}

/**
 * Build a filter structure that matches downloads with any or all of the given tracker URLs.
 * @param {string|string[]} trackerUrls
 * @param {{ combineMode?: 'any'|'all' }} [options]
 */
export function buildTrackerFilter(trackerUrls, options) {
  const urls = (Array.isArray(trackerUrls) ? trackerUrls : [trackerUrls]).filter(
    (url) => url != null && String(url).trim() !== ''
  );
  if (urls.length === 0) {
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  const combineMode = resolveCombineMode(options);
  const groupLogic = isAllCombineMode(combineMode) ? LOGIC_OPERATORS.AND : LOGIC_OPERATORS.OR;

  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: groupLogic,
        filters: urls.map((url) => ({
          column: 'tracker',
          operator: STRING_OPERATORS.EQUALS,
          value: String(url),
        })),
      },
    ],
  };
}

/**
 * True when filters are exclusively tracker equals rules in a single OR/AND group.
 */
export function isTrackerOnlyFilter(filters) {
  const normalized = normalizeFilters(filters);
  const groups = normalized.groups || [];
  if (groups.length !== 1) return false;

  const group = groups[0];
  if (group.logicOperator !== LOGIC_OPERATORS.OR && group.logicOperator !== LOGIC_OPERATORS.AND) {
    return false;
  }

  const activeFilters = (group.filters || []).filter((f) => f.column);
  if (activeFilters.length === 0) return false;

  for (const f of activeFilters) {
    if (f.column !== 'tracker') return false;
    if (f.operator !== STRING_OPERATORS.EQUALS) return false;
    if (f.value == null || String(f.value).trim() === '') return false;
  }

  return true;
}

/**
 * Extract active tracker URLs when filters are tracker-only; otherwise null.
 */
export function getActiveTrackers(filters) {
  if (!isTrackerOnlyFilter(filters)) return null;

  const trackers = [];
  for (const group of filters.groups || []) {
    for (const f of group.filters || []) {
      if (f.column === 'tracker' && f.value != null && String(f.value).trim() !== '') {
        trackers.push(String(f.value));
      }
    }
  }
  return trackers.length > 0 ? trackers : null;
}

/**
 * @param {object} filters
 * @returns {'any'|'all'}
 */
export function getTrackerCombineMode(filters) {
  if (!isTrackerOnlyFilter(filters)) return COMBINE_MODES.ANY;
  const group = filters.groups?.[0];
  return group?.logicOperator === LOGIC_OPERATORS.AND ? COMBINE_MODES.ALL : COMBINE_MODES.ANY;
}

/**
 * Build a filter structure that matches downloads with any or all of the given source hosts.
 * @param {string|string[]} sourceHosts
 * @param {{ combineMode?: 'any'|'all' }} [options]
 */
export function buildSourceFilter(sourceHosts, options) {
  const hosts = (Array.isArray(sourceHosts) ? sourceHosts : [sourceHosts]).filter(
    (host) => host != null && String(host).trim() !== ''
  );
  if (hosts.length === 0) {
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  const combineMode = resolveCombineMode(options);
  const groupLogic = isAllCombineMode(combineMode) ? LOGIC_OPERATORS.AND : LOGIC_OPERATORS.OR;

  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: groupLogic,
        filters: hosts.map((host) => ({
          column: 'original_url',
          operator: STRING_OPERATORS.EQUALS,
          value: String(host),
        })),
      },
    ],
  };
}

/**
 * True when filters are exclusively original_url equals rules in a single OR/AND group.
 */
export function isSourceOnlyFilter(filters) {
  const normalized = normalizeFilters(filters);
  const groups = normalized.groups || [];
  if (groups.length !== 1) return false;

  const group = groups[0];
  if (group.logicOperator !== LOGIC_OPERATORS.OR && group.logicOperator !== LOGIC_OPERATORS.AND) {
    return false;
  }

  const activeFilters = (group.filters || []).filter((f) => f.column);
  if (activeFilters.length === 0) return false;

  for (const f of activeFilters) {
    if (f.column !== 'original_url') return false;
    if (f.operator !== STRING_OPERATORS.EQUALS) return false;
    if (f.value == null || String(f.value).trim() === '') return false;
  }

  return true;
}

/**
 * Extract active source hosts when filters are source-only; otherwise null.
 */
export function getActiveSources(filters) {
  if (!isSourceOnlyFilter(filters)) return null;

  const sources = [];
  for (const group of filters.groups || []) {
    for (const f of group.filters || []) {
      if (f.column === 'original_url' && f.value != null && String(f.value).trim() !== '') {
        sources.push(String(f.value));
      }
    }
  }
  return sources.length > 0 ? sources : null;
}

/**
 * @param {object} filters
 * @returns {'any'|'all'}
 */
export function getSourceCombineMode(filters) {
  if (!isSourceOnlyFilter(filters)) return COMBINE_MODES.ANY;
  const group = filters.groups?.[0];
  return group?.logicOperator === LOGIC_OPERATORS.AND ? COMBINE_MODES.ALL : COMBINE_MODES.ANY;
}

/**
 * Count downloads per tag ID from TBM-enriched download items.
 */
export function countDownloadsPerTag(enrichedDownloads) {
  const counts = {};
  if (!enrichedDownloads?.length) return counts;

  for (const item of enrichedDownloads) {
    for (const tag of item.tags || []) {
      counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
  }
  return counts;
}

/** Whether a saved view can match items on the current asset tab. */
function isViewCompatibleWithAssetTab(viewAssetType, activeAssetType) {
  if (!activeAssetType || activeAssetType === 'all') return true;
  if (!viewAssetType || viewAssetType === 'all') return true;
  return viewAssetType === activeAssetType;
}

/**
 * Count downloads matching filter rules (and optional search), for view editor preview.
 */
export function countDownloadsMatchingFilters(
  filters,
  enrichedDownloads,
  { assetType = null, searchQuery = null } = {}
) {
  const items = enrichedDownloads || [];
  const normalized = mergeViewAssetTypeFilter(filters, assetType);
  const query = searchQuery?.trim() || '';
  const filtersActive = hasActiveFilters(normalized);

  if (!filtersActive && !query) {
    return { matched: 0, total: items.length };
  }

  let matched = 0;
  for (const item of items) {
    if (!item) continue;
    if (query && !itemMatchesDownloadSearch(item, query)) continue;
    if (!filtersActive || itemMatchesFilters(item, normalized)) {
      matched += 1;
    }
  }

  return { matched, total: items.length };
}

/**
 * Count downloads matching each saved view (uses TBM-enriched items for filters).
 * Uses the same filters as apply (including view asset_type). Skips views scoped to another tab.
 */
export function countDownloadsPerView(views, enrichedDownloads, activeAssetType = 'all') {
  const counts = {};
  if (!views?.length) return counts;

  const items = enrichedDownloads || [];

  for (const view of views) {
    if (!isViewCompatibleWithAssetTab(view.asset_type, activeAssetType)) {
      counts[view.id] = 0;
      continue;
    }

    const filters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    if (!hasActiveFilters(filters)) {
      counts[view.id] = 0;
      continue;
    }

    let matchCount = 0;
    for (const item of items) {
      if (item && itemMatchesFilters(item, filters)) {
        matchCount += 1;
      }
    }
    counts[view.id] = matchCount;
  }

  return counts;
}

/**
 * Load view filters into editor state shape.
 */
export function filtersFromView(view) {
  if (!view?.filters) return JSON.parse(JSON.stringify(EMPTY_FILTERS));
  return normalizeFilters(view.filters);
}

/**
 * Apply a saved view's asset_type as an in-memory filter (does not change the asset tab).
 */
export function mergeViewAssetTypeFilter(filters, assetType) {
  if (!assetType || assetType === 'all') {
    return normalizeFilters(filters);
  }

  const normalized = normalizeFilters(filters);
  const assetTypeFilter = {
    column: 'asset_type',
    operator: MULTI_SELECT_OPERATORS.IS_ANY_OF,
    value: [assetType],
  };

  const groups =
    normalized.groups?.length > 0
      ? normalized.groups
      : [{ logicOperator: LOGIC_OPERATORS.AND, filters: [] }];

  const firstGroup = groups[0];
  const withoutAssetType = (firstGroup.filters || []).filter((f) => f.column !== 'asset_type');

  return {
    ...normalized,
    groups: [
      {
        ...firstGroup,
        filters: [...withoutAssetType, assetTypeFilter],
      },
      ...groups.slice(1),
    ],
  };
}

/**
 * True when an item matches any of the given saved views' filter criteria (OR union).
 * @param {object} item
 * @param {object[]} views
 */
function itemMatchesViewFiltersWithCombine(item, views, combine) {
  if (!views?.length) return true;

  const matcher = (view) => {
    const filters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    return hasActiveFilters(filters) && itemMatchesFilters(item, filters);
  };

  return combine === 'every' ? views.every(matcher) : views.some(matcher);
}

/**
 * True when an item matches any of the given saved views' filter criteria (OR union).
 * @param {object} item
 * @param {object[]} views
 */
export function itemMatchesAnyViewFilters(item, views) {
  return itemMatchesViewFiltersWithCombine(item, views, 'some');
}

/**
 * True when an item matches all of the given saved views' filter criteria (AND intersection).
 * @param {object} item
 * @param {object[]} views
 */
export function itemMatchesAllViewFilters(item, views) {
  return itemMatchesViewFiltersWithCombine(item, views, 'every');
}
