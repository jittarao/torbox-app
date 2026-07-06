'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  countActiveConditions,
  getActiveTagIds,
  getActiveTrackers,
  hasActiveFilters,
  isTagOnlyFilter,
  isTrackerOnlyFilter,
} from './filters/filterHelpers';
import { formatTrackerLabel } from './filters/trackerDisplay';

export default function ActiveFiltersBar({
  appliedFilters,
  activeView,
  activeViewIds = [],
  tags,
  onClear,
  onEdit,
}) {
  const t = useTranslations('DownloadsFilters');

  const summary = useMemo(() => {
    if (activeViewIds.length > 1) {
      const base = t('activeViews', { count: activeViewIds.length });
      if (activeView?.search_query?.trim()) {
        return `${base} · ${t('activeSearch', { query: activeView.search_query.trim() })}`;
      }
      return base;
    }

    if (activeView?.name) {
      const base = t('activeView', { name: activeView.name });
      if (activeView.search_query?.trim()) {
        return `${base} · ${t('activeSearch', { query: activeView.search_query.trim() })}`;
      }
      return base;
    }

    const tagIds = getActiveTagIds(appliedFilters);
    if (tagIds?.length === 1) {
      const tag = tags.find((tg) => Number(tg.id) === tagIds[0]);
      if (tag) return t('activeTag', { name: tag.name });
    }
    if (tagIds && tagIds.length > 1) {
      return t('activeTags', { count: tagIds.length });
    }

    const trackers = getActiveTrackers(appliedFilters);
    if (trackers?.length === 1) {
      return t('activeTracker', { name: formatTrackerLabel(trackers[0]) });
    }
    if (trackers && trackers.length > 1) {
      return t('activeTrackers', { count: trackers.length });
    }

    const count = countActiveConditions(appliedFilters);
    if (count > 0) return t('activeConditions', { count });
    return null;
  }, [appliedFilters, activeView, activeViewIds.length, tags, t]);

  if (!hasActiveFilters(appliedFilters) && !activeView) return null;
  if (!summary) return null;

  const showEdit =
    activeView || (!isTagOnlyFilter(appliedFilters) && !isTrackerOnlyFilter(appliedFilters));

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-xs rounded-md border border-accent/30 dark:border-accent-dark/30 bg-accent/5 dark:bg-accent-dark/5">
      <span className="flex-1 min-w-0 truncate text-primary-text dark:text-primary-text-dark">
        {summary}
      </span>
      <div className="flex shrink-0 items-center gap-4">
        {showEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-accent dark:text-accent-dark hover:underline"
          >
            {t('editFilters')}
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
        >
          {t('clearAll')}
        </button>
      </div>
    </div>
  );
}
