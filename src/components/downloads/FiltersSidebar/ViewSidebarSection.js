'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import SidebarListItem from './SidebarListItem';
import { matchesSidebarSearch } from './sidebarSearch';

export default function ViewSidebarSection({
  views = [],
  viewCounts = {},
  searchQuery = '',
  activeViewIds = [],
  onApplyView,
  onClearViews,
  disabled = false,
  renderItemMenu,
}) {
  const t = useTranslations('DownloadsFilters');

  const activeViewIdSet = useMemo(
    () => new Set((activeViewIds || []).map((id) => String(id))),
    [activeViewIds]
  );

  const filteredViews = useMemo(
    () => views.filter((view) => matchesSidebarSearch(searchQuery, view.name)),
    [views, searchQuery]
  );

  const selectedCount = activeViewIds.length;
  const hasSearchQuery = searchQuery.trim().length > 0;

  if (views.length === 0) {
    return (
      <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
        {t('noViews')}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {selectedCount > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-medium text-accent dark:text-accent-dark">
            {t('viewsSelected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onClearViews}
            className="text-[10px] font-medium text-primary-text/55 hover:text-accent dark:text-primary-text-dark/55 dark:hover:text-accent-dark transition-colors"
          >
            {t('clearViews')}
          </button>
        </div>
      )}

      {filteredViews.length === 0 ? (
        <p className="p-2 text-[11px] text-primary-text/50 dark:text-primary-text-dark/50 italic">
          {hasSearchQuery ? t('noViewMatches', { query: searchQuery.trim() }) : t('noViews')}
        </p>
      ) : (
        filteredViews.map((view) => {
          const viewIsActive = activeViewIdSet.has(String(view.id));
          return (
            <SidebarListItem
              key={view.id}
              label={view.name}
              count={viewCounts[view.id]}
              isActive={viewIsActive}
              disabled={disabled}
              title={viewIsActive ? t('toggleFilterOff') : t('toggleFilterOn')}
              onClick={() => !disabled && onApplyView?.(view)}
              {...(renderItemMenu ? renderItemMenu(view, viewIsActive) : {})}
            />
          );
        })
      )}
    </div>
  );
}
