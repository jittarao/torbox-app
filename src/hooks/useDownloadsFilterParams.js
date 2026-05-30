'use client';

import { useCallback, useEffect, useMemo, useRef, startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { getJSON, setJSON, removeItem } from '@/utils/storage';
import {
  EMPTY_FILTERS,
  normalizeFilters,
} from '@/components/downloads/filters/filterHelpers';

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

/** @param {URLSearchParams} params */
function writeSearchToParams(params, value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed) params.set('q', trimmed);
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterResetNonce = useDownloadsUiStore((s) => s.filterResetNonce);

  const criteria = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const replaceParams = useCallback(
    (mutate) => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      mutate(params);
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [pathname, router]
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
      let ok = true;
      replaceParams((params) => {
        ok = writeAppliedFiltersToParams(params, filters);
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

  const resetFilters = useCallback(() => {
    removeItem(FILTERS_OVERFLOW_KEY);
    replaceParams((params) => {
      for (const key of DOWNLOADS_FILTER_PARAM_KEYS) {
        params.delete(key);
      }
    });
  }, [replaceParams]);

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
    resetFilters,
  };
}
