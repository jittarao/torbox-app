'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';
import { useTrackerSidebarData } from './useTrackerSidebarData';

export default function TrackerSidebarSection({
  searchQuery = '',
  activeTrackers = [],
  onApplyTracker,
  onApplyTrackerRange,
  onClearTrackers,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
  const { entries } = useTrackerSidebarData();
  const { lastIndexRef } = useSidebarShiftSelect(searchQuery);

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

  const handleItemClick = useCallback(
    (index, entry, event) => {
      if (disabled) return;

      const isActive = activeTrackerSet.has(entry.url);

      if (event.shiftKey && lastIndexRef.current !== null && onApplyTrackerRange) {
        const start = Math.min(lastIndexRef.current, index);
        const end = Math.max(lastIndexRef.current, index);
        const rangeUrls = filteredEntries.slice(start, end + 1).map((item) => item.url);
        onApplyTrackerRange(rangeUrls, !isActive);
      } else {
        onApplyTracker?.(entry.url);
      }

      lastIndexRef.current = index;
    },
    [disabled, activeTrackerSet, filteredEntries, onApplyTracker, onApplyTrackerRange, lastIndexRef]
  );

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
        filteredEntries.map((entry, index) => {
          const isActive = activeTrackerSet.has(entry.url);
          return (
            <SidebarListItem
              key={entry.url}
              label={entry.label}
              count={entry.count}
              isActive={isActive}
              disabled={disabled}
              title={entry.url}
              onClick={(e) => handleItemClick(index, entry, e)}
            />
          );
        })
      )}
    </div>
  );
}
