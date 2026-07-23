'use client';

import { useTranslations } from 'next-intl';

const SEARCH_SUGGESTIONS = [
  { label: 'IMDB Search', example: 'imdb:tt0133093' },
  { label: 'TVDB Search', example: 'tvdb:12345' },
  { label: 'Anime Search', example: 'jikan:12345' },
  { label: 'TV Show Search', example: 'Breaking Bad' },
  { label: 'Movie Search', example: 'Inception' },
  { label: 'Year Search', example: 'Inception (2010)' },
];

export default function SearchBarDropdowns({
  showHistory,
  showSuggestions,
  searchHistory,
  onHistoryClick,
  onClearHistory,
  onSuggestionClick,
}) {
  const t = useTranslations('SearchBar');

  return (
    <>
      {showHistory && searchHistory.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-border-dark rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-border dark:border-border-dark">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                {t('recentSearches') || 'Recent Searches'}
              </span>
              <button
                type="button"
                onClick={onClearHistory}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                {t('clearHistory') || 'Clear'}
              </button>
            </div>
          </div>
          {searchHistory.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onHistoryClick(item)}
              className="w-full p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-primary-text dark:text-primary-text-dark"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {showSuggestions && !showHistory && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-border dark:border-border-dark rounded-lg shadow-lg">
          <div className="p-2 border-b border-border dark:border-border-dark">
            <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
              {t('searchExamples') || 'Search Examples'}
            </span>
          </div>
          {SEARCH_SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion.label}
              onClick={() => onSuggestionClick(suggestion)}
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
    </>
  );
}
