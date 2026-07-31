import { create } from 'zustand';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { useSessionStore } from '@/store/sessionStore';
import { getItem, setItem, removeItem, getJSON } from '@/utils/storage';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import { useTmdbCredentialsStore } from '@/store/tmdbCredentialsStore';
import { apiKeyStorageScope } from '@/store/downloadsSelectionStore';
import {
  parseMediaId,
  inferTypesForMediaId,
  addonSupportsQuery,
  collectInstalledPrefixes,
} from '@/utils/stremioMediaId';
import { normalizeStream, mergeStreams, sortStreams } from '@/utils/stremioStreamNormalize';
import {
  migrateSearchHistory,
  upsertSearchHistory,
  removeSearchHistoryEntry,
  normalizeHistoryEntry,
  isEnrichableMediaId,
  parseFindQueryFromMediaId,
  mediaTypeToStreamTypes,
  suggestionToHistoryEntry,
  enabledAddonsSupportTmdbPrefix,
} from '@/utils/tmdbSearchQuery';

const HISTORY_KEY_PREFIX = 'stremioSearchHistory:v2';
/** Pre-scoping key — migrated once into the current user's scoped bucket. */
const LEGACY_HISTORY_KEY_UNSCOPED_V2 = 'stremioSearchHistory:v2';
const LEGACY_HISTORY_KEY_V1 = 'stremioSearchHistory:v1';
const LEGACY_HISTORY_KEY = 'torboxSearchHistory:v1';
const CONCURRENCY = 6;

async function runPool(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function resolveApiKey() {
  return useSessionStore.getState().apiKey || getItem('torboxApiKey') || '';
}

/** @param {string} [apiKey] */
export function searchHistoryStorageKey(apiKey) {
  const scope = apiKeyStorageScope(apiKey || resolveApiKey());
  if (!scope) return null;
  return `${HISTORY_KEY_PREFIX}:${scope}`;
}

function filterValidHistoryEntries(entries, prefixes = []) {
  return migrateSearchHistory(entries).filter((entry) => {
    const streamId = entry?.streamId;
    return streamId && parseMediaId(streamId, prefixes).ok;
  });
}

/** Exported for unit tests. */
export function typesNeedRescope(currentTypes, scopedTypes) {
  if (!Array.isArray(scopedTypes) || scopedTypes.length === 0) return false;
  if (!Array.isArray(currentTypes) || currentTypes.length === 0) return false;
  const current = new Set(currentTypes);
  const scoped = new Set(scopedTypes);
  if (scoped.size >= current.size) return false;
  for (const t of scoped) {
    if (!current.has(t)) return false;
  }
  return true;
}

export const useSearchStore = create((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  validationError: null,
  hasSearchCompleted: false,
  activeRequestId: 0,
  abortController: null,
  addonStatuses: [],
  searchHistory: [],
  filterResetNonce: 0,
  pendingSearchQuery: null,
  pendingSearchOptions: null,
  /** Rich TV history entry awaiting episode picker (from typed-id enrich). */
  pendingEpisodePick: null,

  cancelActiveSearch: () => {
    const { abortController, activeRequestId } = get();
    abortController?.abort();
    set({
      loading: false,
      abortController: null,
      activeRequestId: activeRequestId + 1,
    });
  },

  clearResults: () => {
    get().cancelActiveSearch();
    set({
      results: [],
      error: null,
      validationError: null,
      hasSearchCompleted: false,
      addonStatuses: [],
      pendingSearchQuery: null,
      pendingSearchOptions: null,
      pendingEpisodePick: null,
    });
  },

  clearPendingEpisodePick: () => {
    set({ pendingEpisodePick: null });
  },

  setQuery: (query, options = {}) => {
    get().cancelActiveSearch();
    set({
      query,
      results: [],
      error: null,
      validationError: null,
      hasSearchCompleted: false,
      addonStatuses: [],
      pendingSearchQuery: null,
      pendingSearchOptions: null,
      pendingEpisodePick: null,
    });
    if (query) {
      get().fetchResults(query, options);
    }
  },

  addToHistory: (entryOrId) => {
    const configured = useTmdbCredentialsStore.getState().configured;
    let entry = normalizeHistoryEntry(entryOrId) || suggestionToHistoryEntry(entryOrId);
    if (!entry) return;

    // Without TMDB key, only persist plain media ids
    if (!configured && entry.kind === 'tmdb') {
      entry = { kind: 'media_id', streamId: entry.streamId };
    }

    const historyKey = searchHistoryStorageKey();
    if (!historyKey) return;

    const { searchHistory } = get();
    const newHistory = upsertSearchHistory(searchHistory, entry);
    set({ searchHistory: newHistory });
    setItem(historyKey, JSON.stringify(newHistory));
  },

  loadHistory: () => {
    const apiKey = resolveApiKey();
    const historyKey = searchHistoryStorageKey(apiKey);
    if (!historyKey) {
      set({ searchHistory: [] });
      return;
    }

    const prefixes = collectInstalledPrefixes(useStremioAddonsStore.getState().addons);
    const storedScoped = getJSON(historyKey);
    const storedUnscopedV2 = storedScoped ? null : getJSON(LEGACY_HISTORY_KEY_UNSCOPED_V2);
    const storedV1 = storedScoped || storedUnscopedV2 ? null : getJSON(LEGACY_HISTORY_KEY_V1);
    const legacy =
      storedScoped || storedUnscopedV2 || storedV1 ? null : getJSON(LEGACY_HISTORY_KEY);
    const history = filterValidHistoryEntries(
      storedScoped ?? storedUnscopedV2 ?? storedV1 ?? legacy,
      prefixes
    );
    set({ searchHistory: history });

    if (history.length > 0) {
      setItem(historyKey, JSON.stringify(history));
    }

    // Migrate legacy unscoped keys into this user's bucket once, then drop them
    // so another TorBox user on the same browser does not inherit the list.
    if (!storedScoped && (storedUnscopedV2 || storedV1 || legacy)) {
      removeItem(LEGACY_HISTORY_KEY_UNSCOPED_V2);
      removeItem(LEGACY_HISTORY_KEY_V1);
      removeItem(LEGACY_HISTORY_KEY);
    }
  },

  clearHistory: () => {
    set({ searchHistory: [] });
    const historyKey = searchHistoryStorageKey();
    if (historyKey) removeItem(historyKey);
    removeItem(LEGACY_HISTORY_KEY_UNSCOPED_V2);
    removeItem(LEGACY_HISTORY_KEY_V1);
    removeItem(LEGACY_HISTORY_KEY);
  },

  removeFromHistory: (entryOrId) => {
    const entry = normalizeHistoryEntry(entryOrId) || suggestionToHistoryEntry(entryOrId);
    if (!entry) return;

    const historyKey = searchHistoryStorageKey();
    if (!historyKey) return;

    const { searchHistory } = get();
    const newHistory = removeSearchHistoryEntry(searchHistory, entry);
    set({ searchHistory: newHistory });
    if (newHistory.length > 0) {
      setItem(historyKey, JSON.stringify(newHistory));
    } else {
      removeItem(historyKey);
    }
  },

  resetForSession: () => {
    get().cancelActiveSearch();
    set({
      query: '',
      results: [],
      loading: false,
      error: null,
      validationError: null,
      hasSearchCompleted: false,
      addonStatuses: [],
      abortController: null,
      pendingSearchQuery: null,
      pendingSearchOptions: null,
      pendingEpisodePick: null,
      searchHistory: [],
      filterResetNonce: get().filterResetNonce + 1,
    });
    get().loadHistory();
  },

  /**
   * Drop streams belonging to disabled/removed addons (by row id or addon_id).
   */
  invalidateAddonResults: ({ addonRowId, addonId } = {}) => {
    set((state) => {
      const nextResults = state.results.filter((r) => {
        if (addonId && (r.addonId === addonId || r.sources?.some((s) => s.addonId === addonId))) {
          return false;
        }
        return true;
      });
      const nextStatuses = state.addonStatuses.filter((s) => {
        if (addonRowId != null && s.addonRowId === addonRowId) return false;
        if (addonId && s.addonId === addonId) return false;
        return true;
      });
      return {
        results: nextResults,
        addonStatuses: nextStatuses,
      };
    });
  },

  enrichAndMaybeRescope: async (mediaId, requestId, currentTypes) => {
    if (!useTmdbCredentialsStore.getState().configured) return;
    if (!isEnrichableMediaId(mediaId)) return;

    const findQuery = parseFindQueryFromMediaId(mediaId);
    if (!findQuery) return;

    const apiKey = resolveApiKey();
    if (!apiKey) return;

    const addons = useStremioAddonsStore.getState().addons;
    const allowTmdbFallback = enabledAddonsSupportTmdbPrefix(addons);
    const params = new URLSearchParams();
    if (findQuery.imdbId) params.set('imdbId', findQuery.imdbId);
    if (findQuery.tmdbId) params.set('tmdbId', findQuery.tmdbId);
    if (allowTmdbFallback) params.set('allowTmdbFallback', '1');

    try {
      const res = await fetch(`/api/tmdb/find?${params}`, {
        headers: { 'x-api-key': apiKey },
      });
      if (get().activeRequestId !== requestId) return;

      const { ok, data } = await readJsonFromResponse(res);
      if (!ok || !data?.success || !data.result) return;

      const meta = suggestionToHistoryEntry(data.result);
      if (meta) get().addToHistory(meta);

      // TV: upsert rich history and open episode picker — do not rescope bare show id
      // (addons typically need tt…:S:E for useful stream results).
      if (data.result.mediaType === 'tv') {
        if (meta && get().activeRequestId === requestId) {
          get().cancelActiveSearch();
          set({
            pendingEpisodePick: meta,
            results: [],
            addonStatuses: [],
            hasSearchCompleted: false,
            loading: false,
          });
        }
        return;
      }

      const scoped = mediaTypeToStreamTypes(data.result.mediaType);
      if (!typesNeedRescope(currentTypes, scoped)) return;
      if (get().activeRequestId !== requestId) return;

      await get().fetchResults(mediaId, {
        types: scoped,
        historyMeta: meta,
        skipEnrich: true,
      });
    } catch {
      // Best-effort enrichment — ignore network/parse failures
    }
  },

  fetchResults: async (queryOverride, options = {}) => {
    const query = queryOverride ?? get().query;
    if (!query) return;

    const apiKey = resolveApiKey();
    if (!apiKey) {
      get().cancelActiveSearch();
      set({
        error: 'API key is missing',
        validationError: null,
        results: [],
        hasSearchCompleted: false,
        addonStatuses: [],
        pendingSearchQuery: null,
        pendingSearchOptions: null,
      });
      return;
    }

    const addonsState = useStremioAddonsStore.getState();
    if (addonsState.loading) {
      get().cancelActiveSearch();
      set({
        validationError: 'addons_loading',
        error: null,
        loading: false,
        results: [],
        hasSearchCompleted: false,
        addonStatuses: [],
        pendingSearchQuery: query,
        pendingSearchOptions: options,
      });
      return;
    }

    const addons = addonsState.addons;
    const prefixes = collectInstalledPrefixes(addons);
    const parsed = parseMediaId(query, prefixes);
    if (!parsed.ok) {
      get().cancelActiveSearch();
      set({
        validationError: parsed.error,
        error: null,
        loading: false,
        results: [],
        hasSearchCompleted: false,
        addonStatuses: [],
        pendingSearchQuery: null,
        pendingSearchOptions: null,
      });
      return;
    }

    const enabledAddons = addons.filter((a) => a.enabled);
    if (enabledAddons.length === 0) {
      get().cancelActiveSearch();
      set({
        validationError: 'no_addons',
        error: null,
        loading: false,
        results: [],
        hasSearchCompleted: false,
        addonStatuses: [],
        pendingSearchQuery: null,
        pendingSearchOptions: null,
      });
      return;
    }

    const hasTypesOverride = Array.isArray(options.types) && options.types.length > 0;
    const types = hasTypesOverride ? options.types : inferTypesForMediaId(parsed.mediaId);
    const jobs = [];
    for (const addon of enabledAddons) {
      for (const type of types) {
        if (addonSupportsQuery(addon, parsed.mediaId, type)) {
          jobs.push({ addon, type });
        }
      }
    }

    if (jobs.length === 0) {
      get().cancelActiveSearch();
      set({
        validationError: 'no_matching_addons',
        error: null,
        loading: false,
        results: [],
        hasSearchCompleted: true,
        addonStatuses: [],
        pendingSearchQuery: null,
        pendingSearchOptions: null,
      });
      return;
    }

    get().cancelActiveSearch();
    const abortController = new AbortController();
    const requestId = get().activeRequestId + 1;

    if (options.historyMeta) {
      get().addToHistory(options.historyMeta);
    } else {
      get().addToHistory({ kind: 'media_id', streamId: parsed.mediaId });
    }

    const initialStatuses = jobs.map((job) => ({
      key: `${job.addon.id}:${job.type}`,
      addonRowId: job.addon.id,
      addonId: job.addon.addon_id,
      addonName: job.addon.name,
      type: job.type,
      status: 'pending',
      error: null,
      count: 0,
    }));

    set({
      loading: true,
      error: null,
      validationError: null,
      activeRequestId: requestId,
      abortController,
      results: [],
      addonStatuses: initialStatuses,
      query: parsed.mediaId,
      pendingSearchQuery: null,
      pendingSearchOptions: null,
    });

    if (!options.skipEnrich && !hasTypesOverride && isEnrichableMediaId(parsed.mediaId)) {
      void get().enrichAndMaybeRescope(parsed.mediaId, requestId, types);
    }

    const tasks = jobs.map((job, jobIndex) => async () => {
      if (abortController.signal.aborted) return;

      const statusKey = `${job.addon.id}:${job.type}`;
      try {
        const params = new URLSearchParams({
          type: job.type,
          mediaId: parsed.mediaId,
        });
        const res = await fetch(`/api/stremio/addons/${job.addon.id}/stream?${params}`, {
          headers: { 'x-api-key': apiKey },
          signal: abortController.signal,
        });

        if (get().activeRequestId !== requestId) return;

        const { ok, data } = await readJsonFromResponse(res);

        if (!ok || !data.success) {
          set((state) => ({
            addonStatuses: state.addonStatuses.map((s) =>
              s.key === statusKey
                ? {
                    ...s,
                    status: 'error',
                    error: data.error || data.code || `HTTP ${res.status}`,
                  }
                : s
            ),
          }));
          return;
        }

        const streams = Array.isArray(data.streams) ? data.streams : [];
        const normalized = streams
          .map((raw) =>
            normalizeStream(raw, {
              addonId: job.addon.addon_id,
              addonName: job.addon.name,
              addonLogo: job.addon.logo,
              sortOrder: job.addon.sort_order ?? jobIndex,
              streamType: job.type,
            })
          )
          .filter(Boolean);

        if (get().activeRequestId !== requestId) return;

        set((state) => {
          const merged = sortStreams(mergeStreams(state.results, normalized));
          return {
            results: merged,
            addonStatuses: state.addonStatuses.map((s) =>
              s.key === statusKey
                ? {
                    ...s,
                    status: normalized.length === 0 ? 'empty' : 'ok',
                    count: normalized.length,
                    error: null,
                  }
                : s
            ),
          };
        });
      } catch (error) {
        if (abortController.signal.aborted || get().activeRequestId !== requestId) return;
        set((state) => ({
          addonStatuses: state.addonStatuses.map((s) =>
            s.key === statusKey
              ? {
                  ...s,
                  status: 'error',
                  error: error?.name === 'AbortError' ? 'Cancelled' : 'Request failed',
                }
              : s
          ),
        }));
      }
    });

    try {
      await runPool(tasks, CONCURRENCY);
    } finally {
      if (get().activeRequestId === requestId) {
        set({
          loading: false,
          hasSearchCompleted: true,
          abortController: null,
        });
      }
    }
  },
}));
