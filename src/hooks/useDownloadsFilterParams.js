'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { getJSON, setJSON, removeItem } from '@/utils/storage';
import {
  EMPTY_FILTERS,
  normalizeFilters,
} from '@/components/downloads/filters/filterHelpers';
import {
  getDownloadsFilterSearchParamsSnapshot,
  notifyDownloadsFilterSearchParams,
  subscribeDownloadsFilterSearchParams,
} from '@/hooks/downloadsFilterParamsUrl';

const MAX_FILTERS_PARAM_LENGTH = 1800;
const FILTERS_OVERFLOW_KEY = 'torbox-downloads-filters-overflow';

export const DOWNLOADS_FILTER_PARAM_KEYS = ['q', 'status', 'sort', 'dir', 'filters'];

const DEFAULT_SORT = { sortField: 'created_at', sortDirection: 'desc' };

function parseAppliedFilters(raw) {
  if (!raw) return JSON.parse(JSON.stringify(EMPTY_FILTERS));
  try {
    return normalizeFilters(decodeURIComponent(raw));
  } catch {
    return JSON.parse(JSON.stringify(EMPTY_FILTERS));
  }
}

function filtersFromSearchParams(searchParams) {
  const sortField = searchParams.get('sort') || DEFAULT_SORT.sortField;
  const sortDirection = searchParams.get('dir') || DEFAULT_SORT.sortDirection;
  const filtersParam = searchParams.get('filters');
  let appliedFilters;
  if (filtersParam) {
    removeItem(FILTERS_OVERFLOW_KEY);
    appliedFilters = parseAppliedFilters(filtersParam);
  } else {
    const overflow = getJSON(FILTERS_OVERFLOW_KEY);
    appliedFilters = overflow
      ? normalizeFilters(overflow)
      : JSON.parse(JSON.stringify(EMPTY_FILTERS));
  }
  return {
    search: searchParams.get('q') ?? '',
    statusFilter: parseStatusFilterParam(searchParams.get('status')),
    sortField,
    sortDirection,
    appliedFilters,
  };
}

/**
 * @param {string|null} raw
 * @returns {'all'|string|string[]}
 */
export function parseStatusFilterParam(raw) {
  if (!raw) return 'all';
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed === 'all') return 'all';
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
    }
  } catch {
    // Legacy: single stringified filter object in the URL (not JSON-array wrapped).
  }
  return raw;
}

/**
 * @param {'all'|string|string[]|null|undefined} value
 * @returns {string|null} URL param value, or null to clear
 */
export function serializeStatusFilterParam(value) {
  if (value == null || value === 'all') return null;
  if (Array.isArray(value)) {
    return encodeURIComponent(JSON.stringify(value));
  }
  return typeof value === 'string' ? value : encodeURIComponent(JSON.stringify(value));
}

/** @param {URLSearchParams} params */
function writeAppliedFiltersToParams(params, filters) {
  const normalized = normalizeFilters(filters);
  const encoded = encodeURIComponent(JSON.stringify(normalized));
  if (encoded.length > MAX_FILTERS_PARAM_LENGTH) {
    console.warn('Downloads filters too large for URL; using session overflow storage');
    setJSON(FILTERS_OVERFLOW_KEY, normalized);
    params.delete('filters');
    return false;
  }
  removeItem(FILTERS_OVERFLOW_KEY);
  const isEmpty = JSON.stringify(normalized) === JSON.stringify(EMPTY_FILTERS);
  if (isEmpty) params.delete('filters');
  else params.set('filters', encoded);
  return true;
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
  const encoded = serializeStatusFilterParam(value);
  if (encoded) params.set('status', encoded);
  else params.delete('status');
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
      const ok = writeAppliedFiltersToParams(preview, filters);
      replaceParams((params) => {
        writeAppliedFiltersToParams(params, filters);
      });
      return ok;
    },
    [replaceParams]
  );

  /**
   * Apply several filter URL fields in one navigation (avoids stale searchParams races).
   * @param {{ search?: string, statusFilter?: string, sortField?: string, sortDirection?: string, appliedFilters?: object }} patch
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
        if (patch.appliedFilters !== undefined) {
          filtersWritten = writeAppliedFiltersToParams(params, patch.appliedFilters);
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
