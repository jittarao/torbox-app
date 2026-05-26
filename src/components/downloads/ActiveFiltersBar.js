'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  countActiveConditions,
  getActiveTagIds,
  hasActiveFilters,
} from './filters/filterHelpers';

export default function ActiveFiltersBar({
  appliedFilters,
  activeView,
  tags,
  onClear,
  onEdit,
}) {
  const t = useTranslations('DownloadsFilters');

  const summary = useMemo(() => {
    if (activeView?.name) {
      return t('activeView', { name: activeView.name });
    }

    const tagIds = getActiveTagIds(appliedFilters);
    if (tagIds?.length === 1) {
      const tag = tags.find((tg) => Number(tg.id) === tagIds[0]);
      if (tag) return t('activeTag', { name: tag.name });
    }

    const count = countActiveConditions(appliedFilters);
    if (count > 0) return t('activeConditions', { count });
    return null;
  }, [appliedFilters, activeView, tags, t]);

  if (!hasActiveFilters(appliedFilters) && !activeView) return null;
  if (!summary) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 mb-1 text-xs rounded-md border border-accent/30 dark:border-accent-dark/30 bg-accent/5 dark:bg-accent-dark/5">
      <span className="flex-1 min-w-0 truncate text-primary-text dark:text-primary-text-dark">
        {summary}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-accent dark:text-accent-dark hover:underline"
      >
        {t('editFilters')}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
      >
        {t('clearAll')}
      </button>
    </div>
  );
}
