import { create } from 'zustand';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { useSessionStore } from '@/store/sessionStore';
import { getItem, setItem, removeItem, getJSON } from '@/utils/storage';

export const useSearchStore = create((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  hasSearchCompleted: false,
  activeRequestId: 0,
  searchType: 'usenet',
  includeCustomEngines: false,
  searchHistory: [],
  showAdvancedOptions: false,
  /** Bumped on session reset so URL filter params can be cleared. */
  filterResetNonce: 0,

  setSearchType: (type) => {
    set({ searchType: type, results: [], error: null, hasSearchCompleted: false });
    const { query } = get();
    if (query) get().fetchResults(query, type);
  },

  clearResults: () => {
    set({ results: [], error: null, hasSearchCompleted: false });
  },

  setQuery: (query) => {
    set({ query, results: [], error: null, hasSearchCompleted: false });
    if (query) {
      get().addToHistory(query);
      get().fetchResults(query);
    }
  },

  setIncludeCustomEngines: (value) => {
    set({ includeCustomEngines: value });
    const { query, searchType } = get();
    if (query) get().fetchResults(query, searchType);
  },

  setShowAdvancedOptions: (show) => {
    set({ showAdvancedOptions: show });
  },

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 10);
    set({ searchHistory: newHistory });
    setItem('torboxSearchHistory:v1', JSON.stringify(newHistory));
  },

  loadHistory: () => {
    const history = getJSON('torboxSearchHistory:v1') ?? getJSON('torboxSearchHistory');
    if (history && Array.isArray(history)) {
      set({ searchHistory: history });
    }
  },

  clearHistory: () => {
    set({ searchHistory: [] });
    removeItem('torboxSearchHistory:v1');
  },

  resetForSession: () => {
    set({
      query: '',
      results: [],
      loading: false,
      error: null,
      hasSearchCompleted: false,
      filterResetNonce: get().filterResetNonce + 1,
    });
    get().loadHistory();
  },

  fetchResults: async (queryOverride, searchTypeOverride) => {
    const { query: stateQuery, searchType: stateSearchType, includeCustomEngines } = get();
    const query = queryOverride ?? stateQuery;
    const searchType = searchTypeOverride ?? stateSearchType;
    if (!query) return;

    const apiKey = useSessionStore.getState().apiKey || getItem('torboxApiKey');
    if (!apiKey) {
      set({ error: 'API key is missing' });
      return;
    }

    const requestId = get().activeRequestId + 1;
    set({ loading: true, error: null, activeRequestId: requestId });

    try {
      const searchParams = new URLSearchParams({
        query,
        search_user_engines: includeCustomEngines.toString(),
      });

      const endpoint =
        searchType === 'usenet'
          ? `/api/usenet/search?${searchParams}`
          : `/api/torrents/search?${searchParams}`;

      const res = await fetch(endpoint, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const { ok: responseOk, data } = await readJsonFromResponse(res);

      if (get().activeRequestId !== requestId) {
        return;
      }

      if (!responseOk || data.error) {
        set({
          loading: false,
          error: data.error || `Request failed: ${res.status}`,
          hasSearchCompleted: true,
        });
        return;
      }

      const results = searchType === 'usenet' ? data.data?.nzbs || [] : data.data?.torrents || [];

      set({
        results,
        loading: false,
        hasSearchCompleted: true,
      });
    } catch (error) {
      if (get().activeRequestId !== requestId) {
        return;
      }
      set({
        loading: false,
        error: 'Failed to fetch results',
      });
    }
  },
}));
