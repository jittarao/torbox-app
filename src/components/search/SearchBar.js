'use client';
import { useState } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import Dropdown from '@/components/shared/Dropdown';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function SearchBar() {
  const t = useTranslations('SearchBar');
  const commonT = useTranslations('Common');
  const [localQuery, setLocalQuery] = useState('');
  const setQuery = useSearchStore((state) => state.setQuery);
  const searchType = useSearchStore((state) => state.searchType);
  const setSearchType = useSearchStore((state) => state.setSearchType);
  const includeCustomEngines = useSearchStore(
    (state) => state.includeCustomEngines,
  );
  const setIncludeCustomEngines = useSearchStore(
    (state) => state.setIncludeCustomEngines,
  );

  const SEARCH_OPTIONS = [
    { value: 'torrents', label: commonT('itemTypes.Torrents') },
    { value: 'usenet', label: commonT('itemTypes.Usenet') },
  ];

  const handleChange = (e) => {
    setLocalQuery(e.target.value);
  };

  const handleSearch = () => {
    setQuery(localQuery);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCustomEnginesClick = () => {
    setIncludeCustomEngines(!includeCustomEngines);
    handleSearch();
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
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
              onClick={() => {
                setLocalQuery('');
                setQuery('');
              }}
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
      </div>
      <div className="flex justify-end mt-2">
        <label className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {t('customEngines')}
          </span>

          <div
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
              ${
                includeCustomEngines
                  ? 'bg-accent dark:bg-accent-dark'
                  : 'bg-border dark:bg-border-dark'
              }`}
            onClick={() => handleCustomEnginesClick()}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${includeCustomEngines ? 'translate-x-4' : 'translate-x-1'}`}
            />
          </div>
        </label>
      </div>
    </div>
  );
}
