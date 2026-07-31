'use client';

import { useTranslations } from 'next-intl';

export default function SearchBarDropdowns({
  showHistory,
  showSuggestions,
  searchHistory,
  suggestions,
  onSelectHistory,
  onSelectSuggestion,
  onClearHistory,
}) {
  const t = useTranslations('SearchBar');

  if (!showHistory && !showSuggestions) return null;

  return (
    <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-white shadow-lg dark:border-border-dark dark:bg-[#1a1a1d]">
      {showHistory && searchHistory.length > 0 && (
        <div className="border-b border-border p-2 dark:border-border-dark">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs font-medium text-primary-text/60 dark:text-primary-text-dark/60">
              {t('recentSearches')}
            </span>
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-accent hover:underline dark:text-accent-dark"
            >
              {t('clearHistory')}
            </button>
          </div>
          <ul>
            {searchHistory.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                  onClick={() => onSelectHistory(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="p-2">
          <div className="mb-1 px-2 text-xs font-medium text-primary-text/60 dark:text-primary-text-dark/60">
            {t('searchExamples')}
          </div>
          <ul>
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                  onClick={() => onSelectSuggestion(item.id)}
                >
                  <span className="font-mono">{item.id}</span>
                  {item.label ? (
                    <span className="ml-2 text-primary-text/50 dark:text-primary-text-dark/50">
                      {item.label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
