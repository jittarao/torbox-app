import { create } from 'zustand';
import { useSessionStore } from '@/store/sessionStore';
import { getItem, setItem, removeItem } from '@/utils/storage';

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

  seasonFilter: '',
  episodeFilter: '',
  yearFilter: '',
  qualityFilter: '',
  sizeFilter: '',
  seedersFilter: '',

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

  setSeasonFilter: (season) => set({ seasonFilter: season }),
  setEpisodeFilter: (episode) => set({ episodeFilter: episode }),
  setYearFilter: (year) => set({ yearFilter: year }),
  setQualityFilter: (quality) => set({ qualityFilter: quality }),
  setSizeFilter: (size) => set({ sizeFilter: size }),
  setSeedersFilter: (seeders) => set({ seedersFilter: seeders }),

  clearFilters: () => {
    set({
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
    });
  },

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter((item) => item !== query)].slice(0, 10);
    set({ searchHistory: newHistory });
    setItem('torboxSearchHistory:v1', JSON.stringify(newHistory));
  },

  loadHistory: () => {
    try {
      const history =
        getItem('torboxSearchHistory:v1') ??
        getItem('torboxSearchHistory');
      if (history) {
        set({ searchHistory: JSON.parse(history) });
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
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
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
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

      const data = await res.json();

      if (get().activeRequestId !== requestId) {
        return;
      }

      if (!res.ok || data.error) {
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
