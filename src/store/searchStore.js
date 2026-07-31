import { create } from 'zustand';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { useSessionStore } from '@/store/sessionStore';
import { getItem, setItem, removeItem, getJSON } from '@/utils/storage';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import {
  parseMediaId,
  inferTypesForMediaId,
  addonSupportsQuery,
  collectInstalledPrefixes,
} from '@/utils/stremioMediaId';
import { normalizeStream, mergeStreams, sortStreams } from '@/utils/stremioStreamNormalize';

const HISTORY_KEY = 'stremioSearchHistory:v1';
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

function filterValidHistory(entries, prefixes = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((item) => String(item || '').trim())
    .filter((item) => item && parseMediaId(item, prefixes).ok)
    .slice(0, 10);
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
    });
  },

  setQuery: (query) => {
    get().cancelActiveSearch();
    set({
      query,
      results: [],
      error: null,
      validationError: null,
      hasSearchCompleted: false,
      addonStatuses: [],
      pendingSearchQuery: null,
    });
    if (query) {
      get().fetchResults(query);
    }
  },

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 10);
    set({ searchHistory: newHistory });
    setItem(HISTORY_KEY, JSON.stringify(newHistory));
  },

  loadHistory: () => {
    const prefixes = collectInstalledPrefixes(useStremioAddonsStore.getState().addons);
    const stored = getJSON(HISTORY_KEY);
    const legacy = stored ? null : getJSON(LEGACY_HISTORY_KEY);
    const history = filterValidHistory(stored ?? legacy, prefixes);
    set({ searchHistory: history });
    if (!stored && history.length > 0) {
      setItem(HISTORY_KEY, JSON.stringify(history));
    }
  },

  clearHistory: () => {
    set({ searchHistory: [] });
    removeItem(HISTORY_KEY);
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

  fetchResults: async (queryOverride) => {
    const query = queryOverride ?? get().query;
    if (!query) return;

    const apiKey = useSessionStore.getState().apiKey || getItem('torboxApiKey');
    if (!apiKey) {
      get().cancelActiveSearch();
      set({
        error: 'API key is missing',
        validationError: null,
        results: [],
        hasSearchCompleted: false,
        addonStatuses: [],
        pendingSearchQuery: null,
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
      });
      return;
    }

    const types = inferTypesForMediaId(parsed.mediaId);
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
      });
      return;
    }

    get().cancelActiveSearch();
    const abortController = new AbortController();
    const requestId = get().activeRequestId + 1;

    get().addToHistory(parsed.mediaId);

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
    });

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
