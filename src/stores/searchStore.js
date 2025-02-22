import { create } from 'zustand';

export const useSearchStore = create((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  
  setQuery: (query) => {
    set({ query, results: [], error: null });
    if (query) get().fetchResults();
  },

  fetchResults: async () => {
    const { query } = get();
    if (!query) return;

    const apiKey = localStorage.getItem('torboxApiKey');
    if (!apiKey) {
      set({ error: 'API key is missing' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/torrents/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'x-api-key': apiKey
        }
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        set({ 
          loading: false, 
          error: data.error || `Request failed: ${res.status}`
        });
        return;
      }

      const torrents = data.data?.torrents || [];
      set({
        results: torrents,
        loading: false
      });
    } catch (error) {
      set({ 
        loading: false, 
        error: 'Failed to fetch results'
      });
    }
  }
})); 