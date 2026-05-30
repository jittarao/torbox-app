'use client';

import { useCallback, useEffect, useMemo, useRef, startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearchStore } from '@/store/searchStore';

/** URL param names (short) mapped to filter field names used by searchSelectors. */
const PARAM_TO_FIELD = {
  season: 'seasonFilter',
  episode: 'episodeFilter',
  year: 'yearFilter',
  quality: 'qualityFilter',
  size: 'sizeFilter',
  seeders: 'seedersFilter',
};

const FIELD_TO_PARAM = Object.fromEntries(
  Object.entries(PARAM_TO_FIELD).map(([param, field]) => [field, param])
);

export const SEARCH_FILTER_PARAM_KEYS = Object.keys(PARAM_TO_FIELD);

export const EMPTY_SEARCH_FILTERS = {
  seasonFilter: '',
  episodeFilter: '',
  yearFilter: '',
  qualityFilter: '',
  sizeFilter: '',
  seedersFilter: '',
};

function filtersFromSearchParams(searchParams) {
  const filters = { ...EMPTY_SEARCH_FILTERS };
  for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
    filters[field] = searchParams.get(param) ?? '';
  }
  return filters;
}

/**
 * Search page filter state synced to URL query params (shareable links).
 */
export function useSearchFilterParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterResetNonce = useSearchStore((s) => s.filterResetNonce);

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

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

  const setFilter = useCallback(
    (field, value) => {
      const param = FIELD_TO_PARAM[field];
      if (!param) return;
      replaceParams((params) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) params.set(param, trimmed);
        else params.delete(param);
      });
    },
    [replaceParams]
  );

  const clearFilters = useCallback(() => {
    replaceParams((params) => {
      for (const param of SEARCH_FILTER_PARAM_KEYS) {
        params.delete(param);
      }
    });
  }, [replaceParams]);

  useEffect(() => {
    if (filterResetNonce === 0) return;
    clearFilters();
  }, [filterResetNonce, clearFilters]);

  return {
    filters,
    seasonFilter: filters.seasonFilter,
    episodeFilter: filters.episodeFilter,
    yearFilter: filters.yearFilter,
    qualityFilter: filters.qualityFilter,
    sizeFilter: filters.sizeFilter,
    seedersFilter: filters.seedersFilter,
    setSeasonFilter: (v) => setFilter('seasonFilter', v),
    setEpisodeFilter: (v) => setFilter('episodeFilter', v),
    setYearFilter: (v) => setFilter('yearFilter', v),
    setQualityFilter: (v) => setFilter('qualityFilter', v),
    setSizeFilter: (v) => setFilter('sizeFilter', v),
    setSeedersFilter: (v) => setFilter('seedersFilter', v),
    clearFilters,
  };
}
