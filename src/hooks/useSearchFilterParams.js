'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useSearchStore } from '@/store/searchStore';
import {
  getDownloadsFilterSearchParamsSnapshot,
  notifyDownloadsFilterSearchParams,
  subscribeDownloadsFilterSearchParams,
} from '@/hooks/downloadsFilterParamsUrl';
import {
  CODEC_OPTIONS,
  HDR_OPTIONS,
  LANGUAGE_OPTIONS,
} from '@/components/search/searchFilterOptions';

const PARAM_TO_FIELD = {
  resolution: 'resolution',
  codec: 'codec',
  hdr: 'hdr',
  language: 'language',
  addon: 'addonId',
  minsize: 'minSizeGb',
  maxsize: 'maxSizeGb',
  type: 'streamTypes',
};

const FIELD_TO_PARAM = Object.fromEntries(
  Object.entries(PARAM_TO_FIELD).map(([param, field]) => [field, param])
);

export const SEARCH_FILTER_PARAM_KEYS = Object.keys(PARAM_TO_FIELD);

export const EMPTY_SEARCH_FILTERS = {
  resolution: '',
  codec: '',
  hdr: '',
  language: '',
  addonId: '',
  minSizeGb: '',
  maxSizeGb: '',
  streamTypes: '',
};

function parseStreamTypes(raw) {
  if (!raw) return [];
  return [
    ...new Set(
      String(raw)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function normalizePresetValue(raw, options) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (options.some((o) => o.value === value)) return value;
  const lower = value.toLowerCase();
  for (const opt of options) {
    if (!opt.matchAliases) continue;
    if (opt.matchAliases.some((a) => a.toLowerCase() === lower)) return opt.value;
    if (opt.matchAliases.some((a) => lower.includes(a.toLowerCase()))) return opt.value;
  }
  return value;
}

function filtersFromSearchParams(searchParams) {
  const filters = { ...EMPTY_SEARCH_FILTERS };
  for (const [param, field] of Object.entries(PARAM_TO_FIELD)) {
    filters[field] = searchParams.get(param) ?? '';
  }
  filters.codec = normalizePresetValue(filters.codec, CODEC_OPTIONS);
  filters.hdr = normalizePresetValue(filters.hdr, HDR_OPTIONS);
  filters.language = normalizePresetValue(filters.language, LANGUAGE_OPTIONS);
  return filters;
}

/**
 * Stream search filter state synced to URL query params.
 */
export function useSearchFilterParams() {
  const pathname = usePathname();
  const filterResetNonce = useSearchStore((s) => s.filterResetNonce);

  const searchParams = useSyncExternalStore(
    subscribeDownloadsFilterSearchParams,
    getDownloadsFilterSearchParamsSnapshot,
    getDownloadsFilterSearchParamsSnapshot
  );

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const streamTypesList = useMemo(
    () => parseStreamTypes(filters.streamTypes),
    [filters.streamTypes]
  );

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

  const setStreamTypes = useCallback(
    (types) => {
      const list = Array.isArray(types) ? types : parseStreamTypes(types);
      const unique = [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
      setFilter('streamTypes', unique.join(','));
    },
    [setFilter]
  );

  const toggleStreamType = useCallback(
    (type) => {
      const normalized = String(type || '')
        .trim()
        .toLowerCase();
      if (!normalized) return;
      const next = streamTypesList.includes(normalized)
        ? streamTypesList.filter((t) => t !== normalized)
        : [...streamTypesList, normalized];
      setStreamTypes(next);
    },
    [streamTypesList, setStreamTypes]
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

  const streamFilters = useMemo(() => {
    const minGb = parseFloat(filters.minSizeGb);
    const maxGb = parseFloat(filters.maxSizeGb);
    return {
      resolution: filters.resolution,
      codec: filters.codec,
      hdr: filters.hdr,
      language: filters.language,
      addonId: filters.addonId,
      streamTypes: streamTypesList,
      minSizeBytes: Number.isFinite(minGb) && minGb > 0 ? minGb * 1024 * 1024 * 1024 : null,
      maxSizeBytes: Number.isFinite(maxGb) && maxGb > 0 ? maxGb * 1024 * 1024 * 1024 : null,
    };
  }, [filters, streamTypesList]);

  return {
    filters,
    streamFilters,
    resolution: filters.resolution,
    codec: filters.codec,
    hdr: filters.hdr,
    language: filters.language,
    addonId: filters.addonId,
    minSizeGb: filters.minSizeGb,
    maxSizeGb: filters.maxSizeGb,
    streamTypes: streamTypesList,
    setResolution: (v) => setFilter('resolution', v),
    setCodec: (v) => setFilter('codec', v),
    setHdr: (v) => setFilter('hdr', v),
    setLanguage: (v) => setFilter('language', v),
    setAddonId: (v) => setFilter('addonId', v),
    setMinSizeGb: (v) => setFilter('minSizeGb', v),
    setMaxSizeGb: (v) => setFilter('maxSizeGb', v),
    setStreamTypes,
    toggleStreamType,
    clearFilters,
  };
}
