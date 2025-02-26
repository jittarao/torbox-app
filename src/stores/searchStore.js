import { create } from 'zustand';

export const useSearchStore = create((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  searchType: 'torrents',
  includeCustomEngines: false,

  setSearchType: (type) => {
    set({ searchType: type, results: [], error: null });
    const { query } = get();
    if (query) get().fetchResults();
  },

  setQuery: (query) => {
    set({ query, results: [], error: null });
    if (query) get().fetchResults();
  },

  setIncludeCustomEngines: (value) => {
    set({ includeCustomEngines: value });
    const { query } = get();
    if (query) get().fetchResults();
  },

  fetchResults: async () => {
    const { query, searchType, includeCustomEngines } = get();
    if (!query) return;

    const apiKey = localStorage.getItem('torboxApiKey');
    if (!apiKey) {
      set({ error: 'API key is missing' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const searchParams = new URLSearchParams({
        query: encodeURIComponent(query),
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

      if (!res.ok || data.error) {
        set({
          loading: false,
          error: data.error || `Request failed: ${res.status}`,
        });
        return;
      }

      const results =
        searchType === 'usenet'
          ? data.data?.nzbs || []
          : data.data?.torrents || [];

      set({
        results,
        loading: false,
      });
    } catch (error) {
      set({
        loading: false,
        error: 'Failed to fetch results',
      });
    }
  },
}));
