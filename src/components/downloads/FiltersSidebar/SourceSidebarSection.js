'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';
import { useSourceSidebarData } from './useSourceSidebarData';

function LinkIcon({ className = 'size-3.5' }) {
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
        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
      />
    </svg>
  );
}

export default function SourceSidebarSection({
  searchQuery = '',
  activeSources = [],
  onApplySource,
  onApplySourceRange,
  onClearSources,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { entries } = useSourceSidebarData();
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);

  const activeSourceSet = useMemo(
    () => new Set((activeSources || []).map((host) => String(host))),
    [activeSources]
  );

  const filteredEntries = useMemo(
    () => entries.filter((entry) => matchesSidebarSearch(searchQuery, entry.label, entry.host)),
    [entries, searchQuery]
  );

  const selectedCount = activeSourceSet.size;
  const hasSearchQuery = searchQuery.trim().length > 0;

  const handleItemClick = useCallback(
    (index, entry, event) => {
      if (disabled) return;

      const isActive = activeSourceSet.has(entry.host);

      if (event.shiftKey && lastIndexRef.current !== null && onApplySourceRange) {
        const start = Math.min(lastIndexRef.current, index);
        const end = Math.max(lastIndexRef.current, index);
        const rangeHosts = filteredEntries.slice(start, end + 1).map((item) => item.host);
        onApplySourceRange(rangeHosts, !isActive);
      } else {
        onApplySource?.(entry.host);
      }

      lastIndexRef.current = index;
    },
    [disabled, activeSourceSet, filteredEntries, onApplySource, onApplySourceRange, lastIndexRef]
  );

  if (entries.length === 0) {
    return (
      <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
        {t('noSources')}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-accent dark:text-accent-dark">
            {t('sourcesSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onClearSources}
            className="text-[10px] font-medium text-primary-text/55 hover:text-accent dark:text-primary-text-dark/55 dark:hover:text-accent-dark transition-colors"
          >
            {t('clearSources')}
          </button>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
          {hasSearchQuery ? t('noSourceMatches', { query: searchQuery.trim() }) : t('noSources')}
        </p>
      ) : (
        filteredEntries.map((entry, index) => {
          const isActive = activeSourceSet.has(entry.host);
          return (
            <SidebarListItem
              key={entry.host}
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
                  <LinkIcon />
                </span>
              }
              title={entry.host}
              onClick={(e) => handleItemClick(index, entry, e)}
            />
          );
        })
      )}
    </div>
  );
}
