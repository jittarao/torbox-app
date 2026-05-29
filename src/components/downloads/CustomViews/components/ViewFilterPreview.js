'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { countDownloadsMatchingFilters, hasActiveFilters } from '../../filters/filterHelpers';

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
    <div className="flex flex-col gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 dark:border-accent-dark/25 dark:bg-accent-dark/5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {t('previewMatchCount', { count: matched })}
        </p>
        <p className="mt-0.5 text-xs text-primary-text/60 dark:text-primary-text-dark/60">
          {total > 0 ? t('previewMatchCountOfTotal', { matched, total }) : t('previewHint')}
        </p>
      </div>
      {showPreviewButton && onPreview && (
        <button
          type="button"
          onClick={onPreview}
          disabled={!canPreview}
          className="ui-btn-ghost shrink-0 !rounded-xl border border-accent/30 !text-xs text-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-accent-dark/30 dark:text-accent-dark dark:hover:bg-accent-dark/10"
        >
          {t('previewFilters')}
        </button>
      )}
    </div>
  );
}
