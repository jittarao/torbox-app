'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { getJSON, setJSON, removeItem } from '@/utils/storage';
import {
  parseStatusFilterParam,
  serializeStatusFilterParam,
  parseViewIdsFromParams,
  writeViewIdsToParams,
  writeViewIdToParams,
  writeTagIdsToParams,
  writeTrackersToParams,
  parseAppliedFiltersFromParams,
  writeAppliedFiltersToParams,
} from '@/utils/downloadsFilterUrlCodec';
import {
  getDownloadsFilterSearchParamsSnapshot,
  notifyDownloadsFilterSearchParams,
  subscribeDownloadsFilterSearchParams,
} from '@/hooks/downloadsFilterParamsUrl';

export {
  parseStatusFilterParam,
  serializeStatusFilterParam,
} from '@/utils/downloadsFilterUrlCodec';

const MAX_FILTERS_PARAM_LENGTH = 1800;
const FILTERS_OVERFLOW_KEY = 'torbox-downloads-filters-overflow';

export const DOWNLOADS_FILTER_PARAM_KEYS = [
  'q',
  'status',
  'sort',
  'dir',
  'filters',
  'tag',
  'tags',
  'tracker',
  'trackers',
  'view',
  'views',
];

const DEFAULT_SORT = { sortField: 'created_at', sortDirection: 'desc' };

const filterStorage = {
  maxLength: MAX_FILTERS_PARAM_LENGTH,
  overflowKey: FILTERS_OVERFLOW_KEY,
  setJSON,
  removeItem,
  getJSON,
};

function filtersFromSearchParams(searchParams) {
  const sortField = searchParams.get('sort') || DEFAULT_SORT.sortField;
  const sortDirection = searchParams.get('dir') || DEFAULT_SORT.sortDirection;
  const viewIds = parseViewIdsFromParams(searchParams);

  return {
    search: searchParams.get('q') ?? '',
    statusFilter: parseStatusFilterParam(searchParams.get('status')),
    sortField,
    sortDirection,
    viewIds,
    viewId: viewIds?.[0] ?? null,
    appliedFilters: parseAppliedFiltersFromParams(searchParams, filterStorage),
  };
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null} URL `q` value, or null to omit the param
 */
export function downloadsSearchParamFromValue(value) {
  const str = String(value ?? '');
  return str.length > 0 ? str : null;
}

/** @param {URLSearchParams} params */
function writeSearchToParams(params, value) {
  const encoded = downloadsSearchParamFromValue(value);
  if (encoded) params.set('q', encoded);
  else params.delete('q');
}

/** @param {URLSearchParams} params */
function writeStatusFilterToParams(params, value) {
  const serialized = serializeStatusFilterParam(value);
  if (serialized) params.set('status', serialized);
  else params.delete('status');
}

/**
 * Whether a batched criteria patch should write raw `appliedFilters` to the URL.
 * Skip only when the same patch selects a saved view or tag shortcut (those encode
 * filters via `view` / `tag` params). Clearing view/tag with explicit null/empty must
 * still write filters (e.g. custom view preview).
 * @param {{ appliedFilters?: object, viewId?: number|string|null, viewIds?: (number|string)[]|null, tagIds?: number[]|null, trackerUrls?: string[]|null }} patch
 */
export function shouldWriteAppliedFiltersInCriteriaPatch(patch) {
  if (patch.appliedFilters === undefined) return false;
  if (patch.viewIds != null && patch.viewIds.length > 0) return false;
  if (patch.viewId != null) return false;
  if (patch.tagIds != null && patch.tagIds.length > 0) return false;
  if (patch.trackerUrls != null && patch.trackerUrls.length > 0) return false;
  return true;
}

/** @param {URLSearchParams} params */
function writeSortToParams(params, sortField, sortDirection = 'asc') {
  if (sortField && sortField !== DEFAULT_SORT.sortField) {
    params.set('sort', sortField);
  } else {
    params.delete('sort');
  }
  if (sortDirection && sortDirection !== DEFAULT_SORT.sortDirection) {
    params.set('dir', sortDirection);
  } else {
    params.delete('dir');
  }
}

/**
 * Downloads page filter state synced to URL (shareable links).
 * expandedById remains in downloadsUiStore only.
 */
export function useDownloadsFilterParams() {
  const pathname = usePathname();
  const filterResetNonce = useDownloadsUiStore((s) => s.filterResetNonce);

  const searchParams = useSyncExternalStore(
    subscribeDownloadsFilterSearchParams,
    getDownloadsFilterSearchParamsSnapshot,
    getDownloadsFilterSearchParamsSnapshot
  );

  const criteria = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  /** @type {import('react').MutableRefObject<Array<(params: URLSearchParams) => void>>} */
  const pendingMutatorsRef = useRef([]);
  const flushScheduledRef = useRef(false);

  const replaceParams = useCallback(
    (mutate) => {
      pendingMutatorsRef.current.push(mutate);
      if (flushScheduledRef.current) return;
      flushScheduledRef.current = true;

      queueMicrotask(() => {
        flushScheduledRef.current = false;
        const mutators = pendingMutatorsRef.current;
        pendingMutatorsRef.current = [];

        const params = new URLSearchParams(getDownloadsFilterSearchParamsSnapshot().toString());
        for (let i = 0; i < mutators.length; i++) {
          mutators[i](params);
        }
        const qs = params.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;

        if (typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', href);
          notifyDownloadsFilterSearchParams();
        }
      });
    },
    [pathname]
  );

  const setSearch = useCallback(
    (value) => {
      replaceParams((params) => {
        writeSearchToParams(params, value);
      });
    },
    [replaceParams]
  );

  const setStatusFilter = useCallback(
    (value) => {
      replaceParams((params) => {
        writeStatusFilterToParams(params, value);
      });
    },
    [replaceParams]
  );

  const setSort = useCallback(
    (sortField, sortDirection = 'asc') => {
      replaceParams((params) => {
        writeSortToParams(params, sortField, sortDirection);
      });
    },
    [replaceParams]
  );

  const setAppliedFilters = useCallback(
    (filters) => {
      const preview = new URLSearchParams(getDownloadsFilterSearchParamsSnapshot().toString());
      const ok = writeAppliedFiltersToParams(preview, filters, filterStorage);
      replaceParams((params) => {
        writeAppliedFiltersToParams(params, filters, filterStorage);
      });
      return ok;
    },
    [replaceParams]
  );

  /**
   * Apply several filter URL fields in one navigation (avoids stale searchParams races).
   * @param {{
   *   search?: string,
   *   statusFilter?: string,
   *   sortField?: string,
   *   sortDirection?: string,
   *   appliedFilters?: object,
   *   viewId?: number|string|null,
   *   viewIds?: (number|string)[]|null,
   *   tagIds?: number[]|null,
   *   trackerUrls?: string[]|null,
   * }} patch
   */
  const patchFilterCriteria = useCallback(
    (patch) => {
      let filtersWritten = true;
      replaceParams((params) => {
        if (patch.search !== undefined) {
          writeSearchToParams(params, patch.search);
        }
        if (patch.statusFilter !== undefined) {
          writeStatusFilterToParams(params, patch.statusFilter);
        }
        if (patch.sortField !== undefined) {
          writeSortToParams(
            params,
            patch.sortField,
            patch.sortDirection ?? DEFAULT_SORT.sortDirection
          );
        }
        if (patch.viewIds !== undefined) {
          if (patch.viewIds != null && patch.viewIds.length > 0) {
            writeViewIdsToParams(params, patch.viewIds);
          } else {
            params.delete('view');
            params.delete('views');
          }
        } else if (patch.viewId !== undefined) {
          if (patch.viewId != null) {
            writeViewIdToParams(params, patch.viewId);
          } else {
            params.delete('view');
            params.delete('views');
          }
        }
        if (patch.tagIds !== undefined) {
          if (patch.tagIds != null && patch.tagIds.length > 0) {
            writeTagIdsToParams(params, patch.tagIds);
          } else {
            params.delete('tag');
            params.delete('tags');
          }
        }
        if (patch.trackerUrls !== undefined) {
          if (patch.trackerUrls != null && patch.trackerUrls.length > 0) {
            writeTrackersToParams(params, patch.trackerUrls);
          } else {
            params.delete('tracker');
            params.delete('trackers');
          }
        }
        if (shouldWriteAppliedFiltersInCriteriaPatch(patch)) {
          filtersWritten = writeAppliedFiltersToParams(params, patch.appliedFilters, filterStorage);
        }
      });
      return filtersWritten;
    },
    [replaceParams]
  );

  const clearAllFilterCriteria = useCallback(() => {
    removeItem(FILTERS_OVERFLOW_KEY);
    replaceParams((params) => {
      for (const key of DOWNLOADS_FILTER_PARAM_KEYS) {
        params.delete(key);
      }
    });
  }, [replaceParams]);

  const resetFilters = clearAllFilterCriteria;

  useEffect(() => {
    if (filterResetNonce === 0) return;
    resetFilters();
  }, [filterResetNonce, resetFilters]);

  return {
    ...criteria,
    setSearch,
    setStatusFilter,
    setSort,
    setAppliedFilters,
    patchFilterCriteria,
    clearAllFilterCriteria,
    resetFilters,
  };
}
