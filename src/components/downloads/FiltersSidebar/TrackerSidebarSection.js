'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';
import { useTrackerSidebarData } from './useTrackerSidebarData';

function GlobeIcon({ className = 'size-3.5' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.736.413-3.374 1.147-4.818"
      />
    </svg>
  );
}

export default function TrackerSidebarSection({
  searchQuery = '',
  activeTrackers = [],
  onApplyTracker,
  onClearTrackers,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { entries } = useTrackerSidebarData();

  const activeTrackerSet = useMemo(
    () => new Set((activeTrackers || []).map((url) => String(url))),
    [activeTrackers]
  );

  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesSidebarSearch(searchQuery, entry.label, entry.url)),
    [entries, searchQuery]
  );

  const selectedCount = activeTrackerSet.size;
  const hasSearchQuery = searchQuery.trim().length > 0;

  if (entries.length === 0) {
    return (
      <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
        {t('noTrackers')}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-accent dark:text-accent-dark">
            {t('trackersSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onClearTrackers}
            className="text-[10px] font-medium text-primary-text/55 hover:text-accent dark:text-primary-text-dark/55 dark:hover:text-accent-dark transition-colors"
          >
            {t('clearTrackers')}
          </button>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
          {hasSearchQuery ? t('noTrackerMatches', { query: searchQuery.trim() }) : t('noTrackers')}
        </p>
      ) : (
        filteredEntries.map((entry) => {
          const isActive = activeTrackerSet.has(entry.url);
          return (
            <SidebarListItem
              key={entry.url}
              label={entry.label}
              count={entry.count}
              isActive={isActive}
              disabled={disabled}
              leading={
                <span
                  className={`flex size-3.5 shrink-0 items-center justify-center ${
                    isActive
                      ? 'text-accent dark:text-accent-dark'
                      : 'text-primary-text/40 dark:text-primary-text-dark/40'
                  }`}
                  aria-hidden
                >
                  <GlobeIcon />
                </span>
              }
              title={entry.url}
              onClick={() => !disabled && onApplyTracker?.(entry.url)}
            />
          );
        })
      )}
    </div>
  );
}
