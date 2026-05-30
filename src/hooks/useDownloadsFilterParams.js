'use client';

import { useCallback, useEffect, useMemo } from 'react';
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
    statusFilter: searchParams.get('status') || 'all',
    sortField,
    sortDirection,
    appliedFilters,
  };
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

  const replaceParams = useCallback(
    (mutate) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setSearch = useCallback(
    (value) => {
      replaceParams((params) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) params.set('q', trimmed);
        else params.delete('q');
      });
    },
    [replaceParams]
  );

  const setStatusFilter = useCallback(
    (value) => {
      replaceParams((params) => {
        const v = value || 'all';
        if (v && v !== 'all') params.set('status', v);
        else params.delete('status');
      });
    },
    [replaceParams]
  );

  const setSort = useCallback(
    (sortField, sortDirection = 'asc') => {
      replaceParams((params) => {
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
      });
    },
    [replaceParams]
  );

  const setAppliedFilters = useCallback(
    (filters) => {
      const normalized = normalizeFilters(filters);
      const encoded = encodeURIComponent(JSON.stringify(normalized));
      if (encoded.length > MAX_FILTERS_PARAM_LENGTH) {
        console.warn('Downloads filters too large for URL; using session overflow storage');
        setJSON(FILTERS_OVERFLOW_KEY, normalized);
        replaceParams((params) => {
          params.delete('filters');
        });
        return false;
      }
      removeItem(FILTERS_OVERFLOW_KEY);
      replaceParams((params) => {
        const isEmpty =
          JSON.stringify(normalized) === JSON.stringify(EMPTY_FILTERS);
        if (isEmpty) params.delete('filters');
        else params.set('filters', encoded);
      });
      return true;
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
    resetFilters,
  };
}
