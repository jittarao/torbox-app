'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';
import { useSidebarShiftSelect } from './sidebarRangeSelect';

export default function SourceSidebarSection({
  entries = [],
  searchQuery = '',
  activeSources = [],
  onApplySource,
  onApplySourceRange,
  onClearSources,
  disabled = false,
}) {
  const t = useTranslations('DownloadsFilters');
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

  const handleListMouseDown = useCallback((event) => {
    if (event.shiftKey && event.target.closest('[data-sidebar-item]')) {
      event.preventDefault();
    }
  }, []);

  const handleListClick = useCallback(
    (event) => {
      const activateButton = event.target.closest('[data-sidebar-activate]');
      if (!activateButton || disabled) return;

      const row = activateButton.closest('[data-sidebar-item]');
      if (!row) return;

      const index = Number(row.dataset.index);
      const entry = filteredEntries[index];
      if (!entry || entry.host !== row.dataset.id) return;

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
    [disabled, filteredEntries, activeSourceSet, onApplySource, onApplySourceRange, lastIndexRef]
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
        <div onMouseDown={handleListMouseDown} onClick={handleListClick}>
          {filteredEntries.map((entry, index) => {
            const isActive = activeSourceSet.has(entry.host);
            return (
              <SidebarListItem
                key={entry.host}
                itemId={entry.host}
                itemIndex={index}
                label={entry.label}
                count={entry.count}
                isActive={isActive}
                disabled={disabled}
                title={entry.host}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
