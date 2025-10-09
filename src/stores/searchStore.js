import { create } from 'zustand';

export const useSearchStore = create((set, get) => ({
  query: '',
  results: [],
  filteredResults: [],
  loading: false,
  error: null,
  searchType: 'torrents',
  includeCustomEngines: false,
  searchHistory: [],
  showAdvancedOptions: false,
  
  // Filter states
  seasonFilter: '',
  episodeFilter: '',
  yearFilter: '',
  qualityFilter: '',
  sizeFilter: '',
  seedersFilter: '',

  setSearchType: (type) => {
    set({ searchType: type, results: [], filteredResults: [], error: null });
    const { query } = get();
    if (query) get().fetchResults();
  },

  // Clear results when API key changes
  clearResults: () => {
    set({ results: [], filteredResults: [], error: null });
  },

  setQuery: (query) => {
    set({ query, results: [], filteredResults: [], error: null });
    if (query) {
      get().addToHistory(query);
      get().fetchResults();
    }
  },

  setIncludeCustomEngines: (value) => {
    set({ includeCustomEngines: value });
    const { query } = get();
    if (query) get().fetchResults();
  },

  setShowAdvancedOptions: (show) => {
    set({ showAdvancedOptions: show });
  },

  // Filter setters
  setSeasonFilter: (season) => {
    set({ seasonFilter: season });
    get().applyFilters();
  },

  setEpisodeFilter: (episode) => {
    set({ episodeFilter: episode });
    get().applyFilters();
  },

  setYearFilter: (year) => {
    set({ yearFilter: year });
    get().applyFilters();
  },

  setQualityFilter: (quality) => {
    set({ qualityFilter: quality });
    get().applyFilters();
  },

  setSizeFilter: (size) => {
    set({ sizeFilter: size });
    get().applyFilters();
  },

  setSeedersFilter: (seeders) => {
    set({ seedersFilter: seeders });
    get().applyFilters();
  },

  clearFilters: () => {
    set({
      seasonFilter: '',
      episodeFilter: '',
      yearFilter: '',
      qualityFilter: '',
      sizeFilter: '',
      seedersFilter: '',
    });
    get().applyFilters();
  },

  addToHistory: (query) => {
    const { searchHistory } = get();
    const newHistory = [query, ...searchHistory.filter(item => item !== query)].slice(0, 10);
    set({ searchHistory: newHistory });
    localStorage.setItem('torboxSearchHistory', JSON.stringify(newHistory));
  },

  loadHistory: () => {
    try {
      const history = localStorage.getItem('torboxSearchHistory');
      if (history) {
        set({ searchHistory: JSON.parse(history) });
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  },

  clearHistory: () => {
    set({ searchHistory: [] });
    localStorage.removeItem('torboxSearchHistory');
  },

  // Apply filters to results
  applyFilters: () => {
    const { results, seasonFilter, episodeFilter, yearFilter, qualityFilter, sizeFilter, seedersFilter } = get();
    
    let filtered = [...results];

    // Debug logging
    if (seasonFilter || episodeFilter || yearFilter || qualityFilter || sizeFilter || seedersFilter) {
      console.log('Applying filters:', { seasonFilter, episodeFilter, yearFilter, qualityFilter, sizeFilter, seedersFilter });
      console.log('Original results count:', results.length);
    }

    // Season filter
    if (seasonFilter) {
      filtered = filtered.filter(item => {
        const title = (item.raw_title || item.title || '').toLowerCase();
        const seasonPatterns = [
          new RegExp(`s${seasonFilter.padStart(2, '0')}`, 'i'),
          new RegExp(`season\\s*${seasonFilter}`, 'i'),
          new RegExp(`\\b${seasonFilter}x\\d+`, 'i'),
          new RegExp(`season\\s*${seasonFilter.padStart(2, '0')}`, 'i'),
        ];
        const matches = seasonPatterns.some(pattern => pattern.test(title));
        if (matches) {
          console.log('Season filter match:', title);
        }
        return matches;
      });
    }

    // Episode filter
    if (episodeFilter) {
      filtered = filtered.filter(item => {
        const title = (item.raw_title || item.title || '').toLowerCase();
        const episodePatterns = [
          new RegExp(`e${episodeFilter.padStart(2, '0')}`, 'i'),
          new RegExp(`episode\\s*${episodeFilter}`, 'i'),
          new RegExp(`\\b\\d+x${episodeFilter.padStart(2, '0')}`, 'i'),
          new RegExp(`episode\\s*${episodeFilter.padStart(2, '0')}`, 'i'),
        ];
        const matches = episodePatterns.some(pattern => pattern.test(title));
        if (matches) {
          console.log('Episode filter match:', title);
        }
        return matches;
      });
    }

    // Year filter
    if (yearFilter) {
      filtered = filtered.filter(item => {
        const title = item.raw_title || item.title || '';
        // Check both title and parsed data
        const titleMatch = title.includes(yearFilter);
        const parsedMatch = item.title_parsed_data?.year === yearFilter;
        const matches = titleMatch || parsedMatch;
        if (matches) {
          console.log('Year filter match:', title);
        }
        return matches;
      });
    }

    // Quality filter
    if (qualityFilter) {
      filtered = filtered.filter(item => {
        const title = (item.raw_title || item.title || '').toLowerCase();
        const quality = qualityFilter.toLowerCase();
        
        // Check title for quality keywords
        const titleMatch = title.includes(quality);
        
        // Check parsed data for quality
        const parsedMatch = item.title_parsed_data?.quality?.toLowerCase() === quality ||
                           item.title_parsed_data?.resolution?.toLowerCase() === quality;
        
        const matches = titleMatch || parsedMatch;
        if (matches) {
          console.log('Quality filter match:', title);
        }
        return matches;
      });
    }

    // Size filter (min size in GB)
    if (sizeFilter) {
      const minSizeBytes = parseFloat(sizeFilter) * 1024 * 1024 * 1024;
      filtered = filtered.filter(item => {
        const matches = item.size >= minSizeBytes;
        if (matches) {
          console.log('Size filter match:', item.raw_title || item.title, 'Size:', item.size);
        }
        return matches;
      });
    }

    // Seeders filter (min seeders) - use correct field name
    if (seedersFilter) {
      const minSeeders = parseInt(seedersFilter);
      filtered = filtered.filter(item => {
        const matches = (item.last_known_seeders || 0) >= minSeeders;
        if (matches) {
          console.log('Seeders filter match:', item.raw_title || item.title, 'Seeders:', item.last_known_seeders);
        }
        return matches;
      });
    }

    console.log('Filtered results count:', filtered.length);
    set({ filteredResults: filtered });
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

      // Apply any existing filters to new results
      get().applyFilters();
    } catch (error) {
      set({
        loading: false,
        error: 'Failed to fetch results',
      });
    }
  },
}));
