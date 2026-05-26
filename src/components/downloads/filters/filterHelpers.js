import {
  LOGIC_OPERATORS,
  MULTI_SELECT_OPERATORS,
} from '../AutomationRules/constants';
import { isTagsColumn } from '../CustomViews/utils';

export const EMPTY_FILTERS = {
  logicOperator: LOGIC_OPERATORS.AND,
  groups: [
    {
      logicOperator: LOGIC_OPERATORS.AND,
      filters: [],
    },
  ],
};

/**
 * Normalize raw filters (string JSON, flat array, or group structure) to standard group format.
 */
export function normalizeFilters(raw) {
  let filters = raw;

  if (typeof filters === 'string') {
    try {
      filters = JSON.parse(filters);
    } catch {
      return JSON.parse(JSON.stringify(EMPTY_FILTERS));
    }
  }

  if (!filters) {
    return JSON.parse(JSON.stringify(EMPTY_FILTERS));
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

  const groups = filters.groups
    ? filters.groups
    : Array.isArray(filters)
      ? [{ filters }]
      : [];

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
 * Count downloads per tag ID from items with tags attached.
 */
export function countDownloadsPerTag(itemsWithTags) {
  const counts = {};
  if (!itemsWithTags?.length) return counts;

  for (const item of itemsWithTags) {
    for (const tag of item.tags || []) {
      counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
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
