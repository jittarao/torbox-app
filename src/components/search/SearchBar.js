'use client';
import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/store/searchStore';
import { useSearchFilterParams } from '@/hooks/useSearchFilterParams';
import Dropdown from '@/components/shared/Dropdown';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { MagnifyingGlass, Times } from '@/components/icons';
import { useTranslations } from 'next-intl';
import SearchBarDropdowns from './SearchBarDropdowns';
import SearchBarQuickOptions from './SearchBarQuickOptions';
import SearchBarAdvancedFilters from './SearchBarAdvancedFilters';

const DEFAULT_SEARCH_OPTIONS = [
  { value: 'usenet', labelKey: 'itemTypes.Usenet' },
  { value: 'torrents', labelKey: 'itemTypes.Torrents' },
];

export default function SearchBar({ searchTypeOptions: searchTypeOptionsProp }) {
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
  } = useSearchStore(
    useShallow((s) => ({
      setQuery: s.setQuery,
      searchType: s.searchType,
      setSearchType: s.setSearchType,
      includeCustomEngines: s.includeCustomEngines,
      setIncludeCustomEngines: s.setIncludeCustomEngines,
      searchHistory: s.searchHistory,
      showAdvancedOptions: s.showAdvancedOptions,
      setShowAdvancedOptions: s.setShowAdvancedOptions,
      loadHistory: s.loadHistory,
      clearHistory: s.clearHistory,
    }))
  );

  const {
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
  } = useSearchFilterParams();

  const searchTypeOptions = searchTypeOptionsProp ?? DEFAULT_SEARCH_OPTIONS;
  const SEARCH_OPTIONS = searchTypeOptions.map((opt) => ({
    value: opt.value,
    label: opt.labelKey ? commonT(opt.labelKey) : opt.label,
  }));

  const allowedValues = SEARCH_OPTIONS.map((o) => o.value);

  useEffect(() => {
    if (allowedValues.length > 0 && !allowedValues.includes(searchType)) {
      setSearchType(allowedValues[0]);
    }
  }, [allowedValues, searchType, setSearchType]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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

  const handleSearchChange = (e) => {
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
      <div className="relative flex flex-wrap items-center gap-1.5">
        <div className="w-28 shrink-0 sm:w-32">
          <Dropdown options={SEARCH_OPTIONS} value={searchType} onChange={setSearchType} />
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={localQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchHistory.length > 0) setShowHistory(true);
              setShowSuggestions(true);
            }}
            placeholder={t('placeholderSearch')}
            className="w-full rounded-md border border-border bg-transparent py-1.5 pl-9 pr-10 text-sm text-primary-text dark:border-border-dark dark:text-primary-text-dark
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:border-accent-dark dark:focus:ring-accent-dark/20
              transition-colors"
          />
          {localQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 
                text-primary-text/40 dark:text-primary-text-dark/40 
                hover:text-primary-text dark:hover:text-primary-text-dark
                transition-colors"
              aria-label={t('clearSearch')}
            >
              <Times />
            </button>
          )}
          <div
            className="absolute left-3 top-1/2 transform -translate-y-1/2 
                       text-primary-text/40 dark:text-primary-text-dark/40"
          >
            <MagnifyingGlass />
          </div>
        </div>
        <BulkActionButton
          variant="primary"
          onClick={handleSearch}
          label={t('search') || 'Search'}
          title={t('search') || 'Search'}
        />
      </div>

      {searchType === 'torrents' && (
        <div
          className="p-3 text-sm rounded-lg border border-label-warning-text/20 bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark"
          role="status"
        >
          {t('torrentSearchWarning')}
        </div>
      )}

      <SearchBarDropdowns
        showHistory={showHistory}
        showSuggestions={showSuggestions}
        searchHistory={searchHistory}
        onHistoryClick={handleHistoryClick}
        onClearHistory={clearHistory}
        onSuggestionClick={handleSuggestionClick}
      />

      <SearchBarQuickOptions
        includeCustomEngines={includeCustomEngines}
        onCustomEnginesToggle={handleCustomEnginesClick}
        showAdvancedOptions={showAdvancedOptions}
        onToggleAdvancedOptions={() => setShowAdvancedOptions(!showAdvancedOptions)}
      />

      {showAdvancedOptions && (
        <SearchBarAdvancedFilters
          seasonFilter={seasonFilter}
          setSeasonFilter={setSeasonFilter}
          episodeFilter={episodeFilter}
          setEpisodeFilter={setEpisodeFilter}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          qualityFilter={qualityFilter}
          setQualityFilter={setQualityFilter}
          sizeFilter={sizeFilter}
          setSizeFilter={setSizeFilter}
          seedersFilter={seedersFilter}
          setSeedersFilter={setSeedersFilter}
          clearFilters={clearFilters}
        />
      )}
    </div>
  );
}
