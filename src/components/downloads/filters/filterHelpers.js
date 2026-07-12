import {
  LOGIC_OPERATORS,
  MULTI_SELECT_OPERATORS,
  STRING_OPERATORS,
} from '../AutomationRules/constants';
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
    const mb = typeof filter.value === 'number' ? filter.value : parseFloat(filter.value) || 0;
    migrated.value = mb / 1024;
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
 * Normalize raw filters (string JSON, flat array, or group structure) to standard group format.
 */
export function normalizeFilters(raw) {
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
    return migrateCustomViewFilters(JSON.parse(JSON.stringify(filters)));
  }

  if (Array.isArray(filters)) {
    return migrateCustomViewFilters({
      logicOperator: LOGIC_OPERATORS.AND,
      groups: [
        {
          logicOperator: LOGIC_OPERATORS.AND,
          filters,
        },
      ],
    });
  }

  return JSON.parse(JSON.stringify(EMPTY_FILTERS));
}

/**
 * Build a filter structure that matches downloads with any of the given tag IDs.
 */
export function buildTagFilter(tagIds, operator = MULTI_SELECT_OPERATORS.IS_ANY_OF) {
  const ids = Array.isArray(tagIds) ? tagIds : [tagIds];
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

/**
 * True when filters are exclusively a single tag IS_ANY_OF rule.
 */
export function isTagOnlyFilter(filters) {
  const count = countActiveConditions(filters);
  if (count !== 1) return false;

  const groups = filters?.groups || [];
  for (const group of groups) {
    for (const f of group.filters || []) {
      if (!f.column) continue;
      if (!isTagsColumn(f.column)) return false;
      if (f.operator !== MULTI_SELECT_OPERATORS.IS_ANY_OF) return false;
      if (!Array.isArray(f.value) || f.value.length === 0) return false;
    }
  }
  return true;
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
 * Build a filter structure that matches downloads with any of the given tracker URLs.
 */
export function buildTrackerFilter(trackerUrls) {
  const urls = (Array.isArray(trackerUrls) ? trackerUrls : [trackerUrls]).filter(
    (url) => url != null && String(url).trim() !== ''
  );
  if (urls.length === 0) {
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.OR,
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
 * True when filters are exclusively tracker equals rules in a single OR group.
 */
export function isTrackerOnlyFilter(filters) {
  const normalized = normalizeFilters(filters);
  const groups = normalized.groups || [];
  if (groups.length !== 1) return false;

  const group = groups[0];
  if (group.logicOperator !== LOGIC_OPERATORS.OR) return false;

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
 * Build a filter structure that matches downloads with any of the given source hosts.
 */
export function buildSourceFilter(sourceHosts) {
  const hosts = (Array.isArray(sourceHosts) ? sourceHosts : [sourceHosts]).filter(
    (host) => host != null && String(host).trim() !== ''
  );
  if (hosts.length === 0) {
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  return {
    logicOperator: LOGIC_OPERATORS.AND,
    groups: [
      {
        logicOperator: LOGIC_OPERATORS.OR,
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
 * True when filters are exclusively original_url equals rules in a single OR group.
 */
export function isSourceOnlyFilter(filters) {
  const normalized = normalizeFilters(filters);
  const groups = normalized.groups || [];
  if (groups.length !== 1) return false;

  const group = groups[0];
  if (group.logicOperator !== LOGIC_OPERATORS.OR) return false;

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
export function itemMatchesAnyViewFilters(item, views) {
  if (!views?.length) return true;

  return views.some((view) => {
    const filters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    return hasActiveFilters(filters) && itemMatchesFilters(item, filters);
  });
}
