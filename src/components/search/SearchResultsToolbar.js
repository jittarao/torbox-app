'use client';

import { useTranslations } from 'next-intl';
import Dropdown from '@/components/shared/Dropdown';
import { EyeOff } from '@/components/icons';

const SORT_OPTIONS = {
  torrents: [
    { value: 'seeders', label: 'Most Seeders' },
    { value: 'size', label: 'Largest Size' },
    { value: 'age', label: 'Most Recent' },
  ],
  usenet: [
    { value: 'size', label: 'Largest Size' },
    { value: 'age', label: 'Most Recent' },
  ],
};

export default function SearchResultsToolbar({
  resultCount,
  searchType,
  showCachedOnly,
  onShowCachedOnlyChange,
  hideTorBoxIndexers,
  onHideTorBoxIndexersChange,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirToggle,
}) {
  const t = useTranslations('SearchResults');

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg md:text-xl font-semibold text-primary-text dark:text-primary-text-dark">
          {t('results', { count: resultCount })}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer order-2 md:order-1">
          <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {t('cachedOnly')}
          </span>

          <div
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                      ${
                        showCachedOnly
                          ? 'bg-accent dark:bg-accent-dark'
                          : 'bg-border dark:bg-border-dark'
                      }`}
            onClick={() => onShowCachedOnlyChange(!showCachedOnly)}
            role="switch"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onShowCachedOnlyChange(!showCachedOnly);
              }
            }}
            aria-checked={showCachedOnly}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform
                        ${showCachedOnly ? 'translate-x-4' : 'translate-x-1'}`}
            />
          </div>
        </label>

        {searchType === 'usenet' && (
          <label className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
              <EyeOff />
              {t('hideTorBoxIndexers')}
            </span>

            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
              ${
                hideTorBoxIndexers
                  ? 'bg-accent dark:bg-accent-dark'
                  : 'bg-border dark:bg-border-dark'
              }`}
              onClick={() => onHideTorBoxIndexersChange(!hideTorBoxIndexers)}
              role="switch"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onHideTorBoxIndexersChange(!hideTorBoxIndexers);
                }
              }}
              aria-checked={hideTorBoxIndexers}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white transition-transform
                ${hideTorBoxIndexers ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </div>
          </label>
        )}

        <div className="flex items-center gap-2 flex-1 md:flex-none order-1 md:order-2">
          <Dropdown
            options={SORT_OPTIONS[searchType]}
            value={sortKey}
            onChange={onSortKeyChange}
            className="w-full md:w-40"
          />
          <button
            type="button"
            onClick={onSortDirToggle}
            className="p-2 hover:text-accent dark:hover:text-accent-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark rounded-lg transition-colors shrink-0"
          >
            {sortDir === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
