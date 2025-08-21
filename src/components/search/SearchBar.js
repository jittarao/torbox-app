'use client';
import { useState, useEffect, useRef } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import Dropdown from '@/components/shared/Dropdown';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function SearchBar() {
  const t = useTranslations('SearchBar');
  const commonT = useTranslations('Common');
  const [localQuery, setLocalQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  const {
    setQuery,
    searchType,
    setSearchType,
    includeCustomEngines,
    setIncludeCustomEngines,
    searchHistory,
    showAdvancedOptions,
    setShowAdvancedOptions,
    loadHistory,
    clearHistory,
    // Filter states
    seasonFilter,
    setSeasonFilter,
    episodeFilter,
    setEpisodeFilter,
    yearFilter,
    setYearFilter,
    qualityFilter,
    setQualityFilter,
    sizeFilter,
    setSizeFilter,
    seedersFilter,
    setSeedersFilter,
    clearFilters,
  } = useSearchStore();

  // Load search history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowHistory(false);
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SEARCH_OPTIONS = [
    { value: 'torrents', label: commonT('itemTypes.Torrents') },
    { value: 'usenet', label: commonT('itemTypes.Usenet') },
  ];

  const QUALITY_OPTIONS = [
    { value: '', label: 'All Qualities' },
    { value: '2160p', label: '4K (2160p)' },
    { value: '1080p', label: 'Full HD (1080p)' },
    { value: '720p', label: 'HD (720p)' },
    { value: '480p', label: 'SD (480p)' },
    { value: 'HDRip', label: 'HDRip' },
    { value: 'BRRip', label: 'BRRip' },
    { value: 'WEBRip', label: 'WEBRip' },
  ];

  const SEARCH_SUGGESTIONS = [
    { label: 'IMDB Search', example: 'imdb:tt0133093' },
    { label: 'TVDB Search', example: 'tvdb:12345' },
    { label: 'Anime Search', example: 'jikan:12345' },
    { label: 'TV Show Search', example: 'Breaking Bad' },
    { label: 'Movie Search', example: 'Inception' },
    { label: 'Year Search', example: 'Inception (2010)' },
  ];

  const handleChange = (e) => {
    setLocalQuery(e.target.value);
  };

  const handleSearch = () => {
    setQuery(localQuery);
    setShowHistory(false);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowHistory(false);
      setShowSuggestions(false);
    }
  };

  const handleCustomEnginesClick = () => {
    setIncludeCustomEngines(!includeCustomEngines);
    handleSearch();
  };

  const handleHistoryClick = (historyItem) => {
    setLocalQuery(historyItem);
    setQuery(historyItem);
    setShowHistory(false);
  };

  const handleSuggestionClick = (suggestion) => {
    setLocalQuery(suggestion.example);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setLocalQuery('');
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-4 mt-4" ref={searchRef}>
      {/* Main Search Bar */}
      <div className="relative flex gap-2">
        <div className="w-32">
          <Dropdown
            options={SEARCH_OPTIONS}
            value={searchType}
            onChange={setSearchType}
          />
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={localQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchHistory.length > 0) setShowHistory(true);
              setShowSuggestions(true);
            }}
            placeholder={t('placeholder')}
            className="w-full px-4 py-2 pl-10 pr-10 rounded-lg border border-border dark:border-border-dark
              bg-transparent text-sm text-primary-text dark:text-primary-text-dark 
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
              focus:border-accent dark:focus:border-accent-dark
              transition-colors"
          />
          {localQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 
                text-primary-text/40 dark:text-primary-text-dark/40 
                hover:text-primary-text dark:hover:text-primary-text-dark
                transition-colors"
              aria-label={t('clearSearch')}
            >
              <Icons.Times />
            </button>
          )}
          <div
            className="absolute left-3 top-1/2 transform -translate-y-1/2 
                       text-primary-text/40 dark:text-primary-text-dark/40"
          >
            <Icons.MagnifyingGlass />
          </div>
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg
            hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors
            focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20"
        >
          {t('search') || 'Search'}
        </button>
      </div>

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-border-dark rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-border dark:border-border-dark">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                {t('recentSearches') || 'Recent Searches'}
              </span>
              <button
                onClick={clearHistory}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                {t('clearHistory') || 'Clear'}
              </button>
            </div>
          </div>
          {searchHistory.map((item, index) => (
            <button
              key={index}
              onClick={() => handleHistoryClick(item)}
              className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-primary-text dark:text-primary-text-dark"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {/* Search Suggestions Dropdown */}
      {showSuggestions && !showHistory && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-border-dark rounded-lg shadow-lg">
          <div className="p-2 border-b border-border dark:border-border-dark">
            <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
              {t('searchExamples') || 'Search Examples'}
            </span>
          </div>
          {SEARCH_SUGGESTIONS.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                {suggestion.label}
              </div>
              <div className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                {suggestion.example}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Quick Options */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
              <Icons.Cog className="h-4 w-4" />
              {t('customEngines')}
            </span>
            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
                ${
                  includeCustomEngines
                    ? 'bg-accent dark:bg-accent-dark'
                    : 'bg-border dark:bg-border-dark'
                }`}
              onClick={handleCustomEnginesClick}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${includeCustomEngines ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </div>
          </label>

          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
          >
            <Icons.Filter className="h-4 w-4" />
            {showAdvancedOptions ? (t('hideAdvanced') || 'Hide Advanced') : (t('showAdvanced') || 'Show Advanced')}
          </button>
        </div>
      </div>

      {/* Advanced Filter Options */}
      {showAdvancedOptions && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border dark:border-border-dark">
          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('season') || 'Season'}
            </label>
            <input
              type="number"
              min="0"
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
              placeholder={t('seasonPlaceholder') || 'S01'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('episode') || 'Episode'}
            </label>
            <input
              type="number"
              min="0"
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
              placeholder={t('episodePlaceholder') || 'E01'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('year') || 'Year'}
            </label>
            <input
              type="number"
              min="1900"
              max="2030"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
              placeholder={t('yearPlaceholder') || '2024'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('quality') || 'Quality'}
            </label>
            <Dropdown
              options={QUALITY_OPTIONS}
              value={qualityFilter}
              onChange={setQualityFilter}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('minSize') || 'Min Size (GB)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {t('minSeeders') || 'Min Seeders'}
            </label>
            <input
              type="number"
              min="0"
              value={seedersFilter}
              onChange={(e) => setSeedersFilter(e.target.value)}
              className="w-full px-3 py-1 rounded border border-border dark:border-border-dark bg-transparent text-sm text-primary-text dark:text-primary-text-dark focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors"
              placeholder="0"
            />
          </div>

          <div className="col-span-full flex justify-end">
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              {t('clearFilters') || 'Clear Filters'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
