/**
 * Pure derived selectors for downloads list (filter/sort on ids, not persisted arrays).
 */

import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';
import { STATUS_OPTIONS } from '@/components/constants';
import { itemMatchesFilters } from '@/components/downloads/filters/filterEvaluation';
import {
  mergeViewAssetTypeFilter,
  hasActiveFilters,
} from '@/components/downloads/filters/filterHelpers';
import { itemMatchesDownloadSearch } from '@/components/downloads/utils/downloadSearch';
import { buildDownloadHistoryLookup } from '@/components/downloads/utils/tbmDownloadEnrichment';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';

/** @typedef {{ entities?: Record<string, object>, order?: { torrents?: string[], usenet?: string[], webdl?: string[] } }} TorboxDownloadsState */
/** @typedef {{ search?: string, statusFilter?: string, appliedFilters?: object, sortField?: string, sortDirection?: 'asc'|'desc' }} FilterCriteria */

const isQueued = (torrent) =>
  !torrent.download_state &&
  !torrent.download_finished &&
  !torrent.active &&
  torrent.type === 'torrent';

const STATUS_PRIORITY_MAP = {
  Completed: 6,
  Downloading: 5,
  Inactive: 4,
  Queued: 3,
  Seeding: 2,
  Stalled: 1,
  Uploading: 0,
};

const DOWNLOADING_FILTER_VALUE = JSON.stringify({
  active: true,
  download_finished: false,
  download_present: false,
});

const statusFilterValueToLabel = new Map();
for (const opt of STATUS_OPTIONS) {
  if (opt.value && typeof opt.value === 'object' && !Array.isArray(opt.value)) {
    statusFilterValueToLabel.set(JSON.stringify(opt.value), opt.label);
  }
}

const FIELD_TYPE_MAP = {
  id: 'numeric',
  size: 'numeric',
  total_uploaded: 'numeric',
  total_downloaded: 'numeric',
  download_speed: 'numeric',
  upload_speed: 'numeric',
  seeds: 'numeric',
  peers: 'numeric',
  eta: 'numeric',
  progress: 'numeric',
  ratio: 'numeric',
  name: 'text',
  created_at: 'date',
  cached_at: 'date',
  updated_at: 'date',
  expires_at: 'date',
  download_state: 'status',
  file_count: 'file_count',
};

function getStatusPriority(torrent) {
  if (isQueued(torrent)) return STATUS_PRIORITY_MAP.Queued;

  const status = STATUS_OPTIONS.find((option) => {
    if (option.value === 'all' || option.value.is_queued) return false;
    return Object.entries(option.value).every(([key, value]) => {
      if (key === 'download_state') {
        return (Array.isArray(value) ? value : [value]).some((state) =>
          torrent.download_state?.includes(state)
        );
      }
      return torrent[key] === value;
    });
  });

  return STATUS_PRIORITY_MAP[status?.label] ?? -1;
}

function numericCompare(a, b, field) {
  return (Number(a[field]) || 0) - (Number(b[field]) || 0);
}

function textCompare(a, b, field) {
  return (a[field] || '').toLowerCase().localeCompare((b[field] || '').toLowerCase());
}

function dateCompare(a, b, field) {
  return new Date(a[field] || 0) - new Date(b[field] || 0);
}

function statusCompare(a, b) {
  return getStatusPriority(b) - getStatusPriority(a);
}

function fileCountCompare(a, b) {
  return (a.files?.length || 0) - (b.files?.length || 0);
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} sortField
 * @returns {number}
 */
function compareRows(a, b, sortField) {
  const fieldType = FIELD_TYPE_MAP[sortField] || 'text';
  switch (fieldType) {
    case 'numeric':
      return numericCompare(a, b, sortField);
    case 'date':
      return dateCompare(a, b, sortField);
    case 'status':
      return statusCompare(a, b);
    case 'file_count':
      return fileCountCompare(a, b);
    default:
      return textCompare(a, b, sortField);
  }
}

/**
 * @param {string[]} ids
 * @param {Record<string, object>} entities
 * @param {string} sortField
 * @param {'asc'|'desc'} sortDirection
 * @returns {string[]}
 */
export function sortIds(ids, entities, sortField, sortDirection) {
  if (!ids?.length) return [];

  const sorted = ids.toSorted((idA, idB) => {
    const a = entities[idA];
    const b = entities[idB];
    if (!a || !b) return 0;
    const cmp = compareRows(a, b, sortField);
    return sortDirection === 'desc' ? -cmp : cmp;
  });

  return sorted;
}

function matchesStatusFilter(item, statusFilter) {
  if (statusFilter === 'all') return true;

  try {
    const rawFilters = Array.isArray(statusFilter)
      ? statusFilter.map((f) => (typeof f === 'string' ? JSON.parse(f) : f))
      : [typeof statusFilter === 'string' ? JSON.parse(statusFilter) : statusFilter];

    const itemStatus = getMatchingStatus(item);

    if (itemStatus.label === 'Meta_DL' || itemStatus.label === 'Checking_Resume_Data') {
      if (rawFilters.some((f) => JSON.stringify(f) === DOWNLOADING_FILTER_VALUE)) return true;
    }

    return rawFilters.some((filter) => {
      const serialized = JSON.stringify(filter);
      const label = statusFilterValueToLabel.get(serialized);
      if (label !== undefined) return label === itemStatus.label;
      return serialized === JSON.stringify(itemStatus.value);
    });
  } catch (e) {
    if (e instanceof SyntaxError) return false;
    throw e;
  }
}

/**
 * Build row shape used by filter predicates (tags + is_downloaded).
 * @param {object|null} entity
 * @param {Record<string, object[]>} [tagMappings]
 * @param {object} [downloadHistoryLookup]
 * @returns {object|null}
 */
export function enrichRowForFilter(entity, tagMappings, downloadHistoryLookup) {
  if (!entity) return null;
  const downloadId =
    entity.id?.toString() ||
    entity.torrent_id?.toString() ||
    entity.usenet_id?.toString() ||
    entity.web_id?.toString();
  const tags = tagMappings?.[downloadId] || entity.tags || [];
  const lookup =
    downloadHistoryLookup?.itemDownloads != null
      ? downloadHistoryLookup
      : buildDownloadHistoryLookup(downloadHistoryLookup);
  const assetType = entity.assetType || entity.asset_type;
  let isDownloaded;
  if (lookup && assetType) {
    isDownloaded = lookup.itemDownloads.has(`${assetType}:${String(downloadId || entity.id)}`);
  }

  const entityTags = entity.tags || [];
  const tagsUnchanged =
    tags.length === entityTags.length && tags.every((t, i) => t === entityTags[i]);
  const downloadedUnchanged =
    isDownloaded === undefined ||
    entity.is_downloaded === isDownloaded ||
    (entity.is_downloaded === undefined && !isDownloaded);

  if (tagsUnchanged && downloadedUnchanged) {
    return entity;
  }

  const row = { ...entity, tags };
  if (isDownloaded !== undefined) {
    row.is_downloaded = isDownloaded;
  }
  return row;
}

/**
 * @param {string[]} ids
 * @param {Record<string, object>} entities
 * @param {FilterCriteria} criteria
 * @param {Record<string, object[]>} [tagMappings]
 * @param {object} [downloadHistoryLookup]
 * @returns {string[]}
 */
export function filterIds(ids, entities, criteria, tagMappings = {}, downloadHistoryLookup = null) {
  if (!ids?.length) return [];

  const { search = '', statusFilter = 'all', appliedFilters } = criteria;
  const lookup =
    downloadHistoryLookup?.itemDownloads != null
      ? downloadHistoryLookup
      : buildDownloadHistoryLookup(downloadHistoryLookup || []);

  return ids.filter((id) => {
    const entity = entities[id];
    if (!entity) return false;

    const row = enrichRowForFilter(entity, tagMappings, lookup);
    if (!row) return false;

    if (!itemMatchesDownloadSearch(row, search)) return false;
    if (!matchesStatusFilter(row, statusFilter)) return false;
    if (!itemMatchesFilters(row, appliedFilters)) return false;

    return true;
  });
}

/**
 * Like filterIds but operates on a pre-enriched Map<selectionId, row> instead of raw entities.
 * Avoids re-enriching items that were already enriched upstream.
 * @param {string[]} ids
 * @param {Map<string, object>} enrichedMap
 * @param {FilterCriteria} criteria
 * @returns {string[]}
 */
export function filterEnrichedIds(ids, enrichedMap, criteria) {
  if (!ids?.length) return [];

  const { search = '', statusFilter = 'all', appliedFilters } = criteria;

  return ids.filter((id) => {
    const row = enrichedMap.get(id);
    if (!row) return false;

    if (!itemMatchesDownloadSearch(row, search)) return false;
    if (!matchesStatusFilter(row, statusFilter)) return false;
    if (!itemMatchesFilters(row, appliedFilters)) return false;

    return true;
  });
}

/**
 * @param {TorboxDownloadsState} torboxState
 * @param {'torrents'|'usenet'|'webdl'|'all'} viewType
 * @param {FilterCriteria} criteria
 * @param {Record<string, object[]>} [tagMappings]
 * @param {object[]|object} [downloadHistoryOrLookup]
 * @returns {string[]}
 */
export function selectVisibleSortedIds(
  torboxState,
  viewType,
  criteria,
  tagMappings = {},
  downloadHistoryOrLookup = []
) {
  const viewIds = selectViewOrderedIds(torboxState, viewType);
  const entities = torboxState.entities || {};
  const lookup =
    downloadHistoryOrLookup?.itemDownloads != null
      ? downloadHistoryOrLookup
      : buildDownloadHistoryLookup(downloadHistoryOrLookup || []);

  const filtered = filterIds(viewIds, entities, criteria, tagMappings, lookup);
  return sortIds(
    filtered,
    entities,
    criteria.sortField || 'created_at',
    criteria.sortDirection || 'desc'
  );
}

/**
 * Like selectVisibleSortedIds but uses a pre-enriched row map to avoid re-enrichment.
 * @param {string[]} viewIds
 * @param {Map<string, object>} enrichedMap
 * @param {FilterCriteria} criteria
 * @param {Record<string, object>} entities
 * @returns {string[]}
 */
export function selectVisibleSortedFromMap(viewIds, enrichedMap, criteria, entities) {
  const filtered = filterEnrichedIds(viewIds, enrichedMap, criteria);
  return sortIds(
    filtered,
    entities,
    criteria.sortField || 'created_at',
    criteria.sortDirection || 'desc'
  );
}

/**
 * Resolve visible ids to row objects (for bulk actions / legacy callers).
 * @param {string[]} ids
 * @param {Record<string, object>} entities
 * @param {Record<string, object[]>} [tagMappings]
 * @param {object[]} [downloadHistory]
 * @returns {object[]}
 */
export function idsToRows(ids, entities, tagMappings = {}, downloadHistory = []) {
  if (!ids?.length) return [];
  const lookup = buildDownloadHistoryLookup(downloadHistory);
  return ids
    .map((id) => entities[id])
    .filter(Boolean)
    .map((entity) => enrichRowForFilter(entity, tagMappings, lookup));
}

/**
 * Status counts for ActionBar from view ids (unfiltered by search/status/column).
 */
export function selectStatusCountsFromIds(torboxState, viewType) {
  const viewIds = selectViewOrderedIds(torboxState, viewType);
  const entities = torboxState.entities || {};
  const counts = {};

  for (const id of viewIds) {
    const item = entities[id];
    if (!item) continue;
    const status = getMatchingStatus(item);
    if (status?.label) {
      counts[status.label] = (counts[status.label] || 0) + 1;
    }
  }

  return { counts, total: viewIds.length };
}

/**
 * Tag counts for sidebar — uses tagMappings + view ids (no enriched array).
 */
export function countDownloadsPerTagFromStore(torboxState, viewType, tagMappings = {}) {
  const viewIds = selectViewOrderedIds(torboxState, viewType);
  const entities = torboxState.entities || {};
  const counts = {};

  for (const id of viewIds) {
    const entity = entities[id];
    if (!entity) continue;
    const downloadId = entity.id?.toString();
    const tags = tagMappings[downloadId] || entity.tags || [];
    for (const tag of tags) {
      counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Per-view match counts for sidebar (filter rules on entities).
 */
export function countDownloadsPerViewFromStore(
  views,
  torboxState,
  activeAssetType,
  tagMappings = {},
  downloadHistory = []
) {
  const counts = {};
  if (!views?.length) return counts;

  const lookup = buildDownloadHistoryLookup(downloadHistory);
  const entities = torboxState.entities || {};
  const viewIds = selectViewOrderedIds(torboxState, activeAssetType);

  for (const view of views) {
    if (
      view.asset_type &&
      activeAssetType !== 'all' &&
      view.asset_type !== 'all' &&
      view.asset_type !== activeAssetType
    ) {
      counts[view.id] = 0;
      continue;
    }

    const filters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    if (!hasActiveFilters(filters)) {
      counts[view.id] = 0;
      continue;
    }

    const matched = filterIds(
      viewIds,
      entities,
      {
        search: view.search_query || '',
        statusFilter: 'all',
        appliedFilters: filters,
      },
      tagMappings,
      lookup
    );
    counts[view.id] = matched.length;
  }

  return counts;
}

export function findEntityBySelectionId(entities, ids, selectionId) {
  for (const id of ids) {
    const item = entities[id];
    if (!item) continue;
    if (getDownloadSelectionId(item) === selectionId) return item;
    if (item.id === selectionId || String(item.id) === String(selectionId)) return item;
  }
  return undefined;
}
