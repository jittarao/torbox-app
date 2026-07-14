/**
 * Downloads page URL filter codec.
 *
 * Params: status (slugs), tag, tags, tracker, trackers, source, sources, view, filters (compact JSON), q, sort, dir.
 * Never pre-encode with encodeURIComponent before URLSearchParams.set().
 */

import { STATUS_OPTIONS } from '@/components/constants';
import { LOGIC_OPERATORS } from '@/components/downloads/AutomationRules/constants';
import {
  EMPTY_FILTERS,
  normalizeFilters,
  hasActiveFilters,
  getActiveTagIds,
  getActiveTrackers,
  getActiveSources,
  getTagCombineMode,
  getTrackerCombineMode,
  getSourceCombineMode,
  buildTagFilter,
  buildTrackerFilter,
  buildSourceFilter,
  isTrackerOnlyFilter,
  isSourceOnlyFilter,
} from '@/components/downloads/filters/filterHelpers';
import {
  parseSectionCombineModeFromParams,
  writeSectionCombineModeToParams,
  clearSectionCombineModeParams,
} from '@/components/downloads/filters/sidebarCombineMode';

const EMPTY_FILTERS_JSON = JSON.stringify(EMPTY_FILTERS);

/** @type {Map<string, string>} slug -> JSON.stringify(STATUS_OPTIONS.value) */
const slugToStatusJson = new Map();

/** @type {Map<string, string>} JSON.stringify(value) -> slug */
const statusJsonToSlug = new Map();

for (const opt of STATUS_OPTIONS) {
  if (!opt.value || opt.value === 'all' || typeof opt.value !== 'object') continue;
  const slug = opt.label.toLowerCase();
  const json = JSON.stringify(opt.value);
  slugToStatusJson.set(slug, json);
  statusJsonToSlug.set(json, slug);
}

export const STATUS_FILTER_SLUGS = [...slugToStatusJson.keys()];

export const FILTER_SHORTCUT_PARAM_KEYS = [
  'tag',
  'tags',
  'tracker',
  'trackers',
  'source',
  'sources',
  'view',
  'views',
  'filters',
];

const SHORTCUT_PARAM_DELIMITER = '|';

function deleteFilterShortcutParams(params) {
  for (const key of FILTER_SHORTCUT_PARAM_KEYS) {
    params.delete(key);
  }
  clearSectionCombineModeParams(params);
}

/**
 * @param {string|null|undefined} raw
 * @returns {'all'|string[]}
 */
export function parseStatusFilterParam(raw) {
  if (!raw || raw === 'all') return 'all';

  if (!raw.includes('{') && !raw.includes('[') && !raw.includes('%')) {
    const slugs = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const mapped = slugs.map((slug) => slugToStatusJson.get(slug)).filter(Boolean);
    if (mapped.length > 0) return mapped;
  }

  const legacy = tryParseLegacyStatus(raw);
  if (legacy !== 'all') return legacy;

  return 'all';
}

/**
 * @param {'all'|string|string[]|null|undefined} value
 * @returns {string|null}
 */
export function serializeStatusFilterParam(value) {
  if (value == null || value === 'all') return null;

  const items = Array.isArray(value) ? value : [value];
  const slugs = [];

  for (const item of items) {
    const json = typeof item === 'string' ? item : JSON.stringify(item);
    const slug = statusJsonToSlug.get(json);
    if (slug) slugs.push(slug);
  }

  if (slugs.length > 0) return slugs.join(',');
  return null;
}

/**
 * @param {string|null|undefined} raw
 * @returns {number[]|null}
 */
export function parseTagIdsFromParams(searchParams) {
  const single = searchParams.get('tag');
  if (single != null && single !== '') {
    const id = Number(single);
    return Number.isFinite(id) ? [id] : null;
  }
  const multi = searchParams.get('tags');
  if (!multi) return null;
  const ids = multi
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : null;
}

/**
 * @param {URLSearchParams} params
 * @param {number[]} tagIds
 * @param {'any'|'all'} [combineMode]
 */
export function writeTagIdsToParams(params, tagIds, combineMode) {
  deleteFilterShortcutParams(params);

  const ids = (tagIds || []).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return;
  if (ids.length === 1) params.set('tag', String(ids[0]));
  else params.set('tags', ids.join(','));
  writeSectionCombineModeToParams(params, 'tags', combineMode);
}

/**
 * @param {string|null|undefined} raw
 * @returns {number|string|null}
 */
export function parseViewIdParam(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : raw;
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {(number|string)[]|null}
 */
export function parseViewIdsFromParams(searchParams) {
  const single = searchParams.get('view');
  if (single != null && single !== '') {
    const id = parseViewIdParam(single);
    return id != null ? [id] : null;
  }

  const multi = searchParams.get('views');
  if (!multi) return null;

  const ids = multi
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseViewIdParam(s))
    .filter((id) => id != null);

  return ids.length > 0 ? ids : null;
}

/**
 * @param {URLSearchParams} params
 * @param {(number|string)[]} viewIds — order preserved (first view wins for presets)
 * @param {'any'|'all'} [combineMode]
 */
export function writeViewIdsToParams(params, viewIds, combineMode) {
  deleteFilterShortcutParams(params);

  const ids = (viewIds || []).filter((id) => id != null && id !== '');
  if (ids.length === 0) return;
  if (ids.length === 1) params.set('view', String(ids[0]));
  else params.set('views', ids.map(String).join(','));
  writeSectionCombineModeToParams(params, 'views', combineMode);
}

/**
 * @param {URLSearchParams} params
 * @param {number|string|null|undefined} viewId
 */
export function writeViewIdToParams(params, viewId) {
  if (viewId == null || viewId === '') {
    params.delete('view');
    params.delete('views');
    return;
  }
  writeViewIdsToParams(params, [viewId]);
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {string[]|null}
 */
export function parseTrackersFromParams(searchParams) {
  const single = searchParams.get('tracker');
  if (single != null && single !== '') {
    return [single];
  }

  const multi = searchParams.get('trackers');
  if (!multi) return null;

  const trackers = multi
    .split(SHORTCUT_PARAM_DELIMITER)
    .map((segment) => {
      try {
        return decodeURIComponent(segment.trim());
      } catch {
        return segment.trim();
      }
    })
    .filter((url) => url !== '');

  return trackers.length > 0 ? trackers : null;
}

/**
 * @param {URLSearchParams} params
 * @param {string[]} trackerUrls
 * @param {'any'|'all'} [combineMode]
 */
export function writeTrackersToParams(params, trackerUrls, combineMode) {
  deleteFilterShortcutParams(params);

  const urls = (trackerUrls || []).filter((url) => url != null && String(url).trim() !== '');
  if (urls.length === 0) return;
  if (urls.length === 1) {
    params.set('tracker', urls[0]);
    writeSectionCombineModeToParams(params, 'trackers', combineMode);
    return;
  }

  params.set(
    'trackers',
    urls.map((url) => encodeURIComponent(String(url))).join(SHORTCUT_PARAM_DELIMITER)
  );
  writeSectionCombineModeToParams(params, 'trackers', combineMode);
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {string[]|null}
 */
export function parseSourcesFromParams(searchParams) {
  const single = searchParams.get('source');
  if (single != null && single !== '') {
    return [single];
  }

  const multi = searchParams.get('sources');
  if (!multi) return null;

  const sources = multi
    .split(SHORTCUT_PARAM_DELIMITER)
    .map((segment) => {
      try {
        return decodeURIComponent(segment.trim());
      } catch {
        return segment.trim();
      }
    })
    .filter((host) => host !== '');

  return sources.length > 0 ? sources : null;
}

/**
 * @param {URLSearchParams} params
 * @param {string[]} sourceHosts
 * @param {'any'|'all'} [combineMode]
 */
export function writeSourcesToParams(params, sourceHosts, combineMode) {
  deleteFilterShortcutParams(params);

  const hosts = (sourceHosts || []).filter((host) => host != null && String(host).trim() !== '');
  if (hosts.length === 0) return;
  if (hosts.length === 1) {
    params.set('source', hosts[0]);
    writeSectionCombineModeToParams(params, 'sources', combineMode);
    return;
  }

  params.set(
    'sources',
    hosts.map((host) => encodeURIComponent(String(host))).join(SHORTCUT_PARAM_DELIMITER)
  );
  writeSectionCombineModeToParams(params, 'sources', combineMode);
}

/** Clear tag/view/filters shortcut params. */
export function clearFilterShortcutParams(params) {
  deleteFilterShortcutParams(params);
}

/**
 * @param {object} filters
 * @returns {string}
 */
export function compactFiltersToUrl(filters) {
  const normalized = normalizeFilters(filters);
  if (!hasActiveFilters(normalized)) return '';

  /** @param {object} row */
  const compactRow = (row) => {
    const out = { c: row.column, o: row.operator };
    if (row.value !== undefined && row.value !== null) out.v = row.value;
    return out;
  };

  const groups = (normalized.groups || [])
    .map((group) => {
      const rows = (group.filters || []).filter((f) => f.column).map(compactRow);
      if (rows.length === 0) return null;
      const cg = { f: rows };
      if (group.logicOperator && group.logicOperator !== LOGIC_OPERATORS.AND) {
        cg.lo = group.logicOperator;
      }
      return cg;
    })
    .filter(Boolean);

  const compact = { g: groups };
  if (normalized.logicOperator && normalized.logicOperator !== LOGIC_OPERATORS.AND) {
    compact.lo = normalized.logicOperator;
  }

  return JSON.stringify(compact);
}

/**
 * @param {object} compact
 * @returns {object}
 */
function expandCompactFilters(compact) {
  const logicOperator = compact.lo || LOGIC_OPERATORS.AND;
  const groups = (compact.g || []).map((group) => ({
    logicOperator: group.lo || LOGIC_OPERATORS.AND,
    filters: (group.f || []).map((row) => ({
      column: row.c,
      operator: row.o,
      value: row.v !== undefined ? row.v : null,
    })),
  }));

  return normalizeFilters({ logicOperator, groups });
}

/**
 * @param {string|null|undefined} raw
 * @returns {object}
 */
export function compactFiltersFromUrl(raw) {
  if (!raw) return JSON.parse(EMPTY_FILTERS_JSON);

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.g)) {
      return expandCompactFilters(parsed);
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.groups)) {
      return normalizeFilters(parsed);
    }
  } catch {
    // fall through to legacy attempt
  }

  return tryParseLegacyFilters(raw);
}

/**
 * @param {string} raw
 * @returns {object}
 */
export function tryParseLegacyFilters(raw) {
  try {
    let value = raw;
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'string') {
          value = parsed;
          continue;
        }
        return normalizeFilters(parsed);
      } catch {
        if (value.includes('%')) {
          value = decodeURIComponent(value);
          continue;
        }
        break;
      }
    }
  } catch {
    // ignore
  }
  return JSON.parse(EMPTY_FILTERS_JSON);
}

/**
 * @param {string} raw
 * @returns {'all'|string[]}
 */
export function tryParseLegacyStatus(raw) {
  try {
    let value = raw;
    for (let i = 0; i < 2; i++) {
      try {
        const parsed = JSON.parse(value);
        if (parsed === 'all') return 'all';
        if (Array.isArray(parsed)) {
          return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
        }
        if (typeof parsed === 'object' && parsed !== null) {
          return [JSON.stringify(parsed)];
        }
      } catch {
        if (value.includes('%')) {
          value = decodeURIComponent(value);
          continue;
        }
        break;
      }
    }
  } catch {
    // ignore
  }

  if (raw.includes('{') && statusJsonToSlug.has(raw)) {
    return [raw];
  }

  return 'all';
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ getJSON?: (key: string) => unknown, removeItem?: (key: string) => void, overflowKey?: string }} [storage]
 * @returns {object}
 */
export function parseAppliedFiltersFromParams(searchParams, storage = {}) {
  const { getJSON, removeItem, overflowKey } = storage;

  const viewIds = parseViewIdsFromParams(searchParams);
  if (viewIds) {
    if (removeItem && overflowKey) removeItem(overflowKey);
    return JSON.parse(EMPTY_FILTERS_JSON);
  }

  const tagIds = parseTagIdsFromParams(searchParams);
  if (tagIds) {
    if (removeItem && overflowKey) removeItem(overflowKey);
    const combineMode = parseSectionCombineModeFromParams(searchParams, 'tags');
    return buildTagFilter(tagIds.length === 1 ? tagIds[0] : tagIds, { combineMode });
  }

  const trackerUrls = parseTrackersFromParams(searchParams);
  if (trackerUrls) {
    if (removeItem && overflowKey) removeItem(overflowKey);
    const combineMode = parseSectionCombineModeFromParams(searchParams, 'trackers');
    return buildTrackerFilter(trackerUrls, { combineMode });
  }

  const sourceHosts = parseSourcesFromParams(searchParams);
  if (sourceHosts) {
    if (removeItem && overflowKey) removeItem(overflowKey);
    const combineMode = parseSectionCombineModeFromParams(searchParams, 'sources');
    return buildSourceFilter(sourceHosts, { combineMode });
  }

  const filtersParam = searchParams.get('filters');
  if (filtersParam) {
    if (removeItem && overflowKey) removeItem(overflowKey);
    return compactFiltersFromUrl(filtersParam);
  }

  if (getJSON && overflowKey) {
    const overflow = getJSON(overflowKey);
    if (overflow) return normalizeFilters(overflow);
  }

  return JSON.parse(EMPTY_FILTERS_JSON);
}

/**
 * @param {URLSearchParams} params
 * @param {object} filters
 * @param {{ maxLength: number, overflowKey: string, setJSON: (key: string, value: unknown) => void, removeItem: (key: string) => void }} storage
 * @returns {boolean}
 */
export function writeAppliedFiltersToParams(params, filters, storage) {
  const { maxLength, overflowKey, setJSON, removeItem } = storage;
  const normalized = normalizeFilters(filters);

  params.delete('view');
  params.delete('views');

  if (!hasActiveFilters(normalized)) {
    clearFilterShortcutParams(params);
    removeItem(overflowKey);
    return true;
  }

  const tagIds = getActiveTagIds(normalized);
  if (tagIds) {
    writeTagIdsToParams(params, tagIds, getTagCombineMode(normalized));
    removeItem(overflowKey);
    return true;
  }

  if (isTrackerOnlyFilter(normalized)) {
    const trackers = getActiveTrackers(normalized);
    if (trackers) {
      writeTrackersToParams(params, trackers, getTrackerCombineMode(normalized));
      removeItem(overflowKey);
      return true;
    }
  }

  if (isSourceOnlyFilter(normalized)) {
    const sources = getActiveSources(normalized);
    if (sources) {
      writeSourcesToParams(params, sources, getSourceCombineMode(normalized));
      removeItem(overflowKey);
      return true;
    }
  }

  params.delete('tag');
  params.delete('tags');
  params.delete('tracker');
  params.delete('trackers');
  params.delete('source');
  params.delete('sources');

  const compact = compactFiltersToUrl(normalized);
  if (compact.length > maxLength) {
    console.warn('Downloads filters too large for URL; using session overflow storage');
    setJSON(overflowKey, normalized);
    params.delete('filters');
    return false;
  }

  removeItem(overflowKey);
  params.set('filters', compact);
  return true;
}
