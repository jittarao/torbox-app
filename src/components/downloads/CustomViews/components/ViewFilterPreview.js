'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  countDownloadsMatchingFilters,
  hasActiveFilters,
} from '../../filters/filterHelpers';

export default function ViewFilterPreview({
  filters,
  previewItems,
  assetType,
  searchQuery,
  onPreview,
  previewDisabled = false,
  showPreviewButton = true,
}) {
  const t = useTranslations('CustomViews');

  const { matched, total } = useMemo(
    () =>
      countDownloadsMatchingFilters(filters, previewItems, {
        assetType,
        searchQuery,
      }),
    [filters, previewItems, assetType, searchQuery]
  );

  const filtersActive = hasActiveFilters(filters);
  const hasSearch = !!searchQuery?.trim();
  const canPreview = (filtersActive || hasSearch) && !previewDisabled;

  if (!filtersActive && !hasSearch) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-surface-alt/80 dark:bg-surface-alt-dark/50 border border-border/60 dark:border-border-dark/60">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {t('previewMatchCount', { count: matched })}
        </p>
        <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60 mt-0.5">
          {total > 0
            ? t('previewMatchCountOfTotal', { matched, total })
            : t('previewHint')}
        </p>
      </div>
      {showPreviewButton && onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={!canPreview}
          className="shrink-0 px-4 py-2 text-sm font-medium border border-accent dark:border-accent-dark text-accent dark:text-accent-dark rounded-md hover:bg-accent/10 dark:hover:bg-accent-dark/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('previewFilters')}
        </button>
      )}
    </div>
  );
}
