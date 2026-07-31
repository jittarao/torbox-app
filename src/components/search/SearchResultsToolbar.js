'use client';

import { useTranslations } from 'next-intl';
import Dropdown from '@/components/shared/Dropdown';
import { ToggleSwitch } from '@/components/downloads/apiKeyManagerHelpers';

const segmentBtnBase =
  'px-2.5 py-1 text-xs border rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/30 dark:focus-visible:ring-accent-dark/30';

function densityBtnClass(active, { segment, otherActive } = {}) {
  const inactive =
    'border-border text-primary-text/70 hover:text-primary-text dark:border-border-dark dark:text-primary-text-dark/70 dark:hover:text-primary-text-dark';
  const activeAccent = 'border-accent text-accent dark:border-accent-dark dark:text-accent-dark';

  if (!active) {
    const hideSharedBorder =
      segment === 'left' && otherActive
        ? ' border-r-transparent dark:border-r-transparent'
        : segment === 'right' && otherActive
          ? ' border-l-transparent dark:border-l-transparent'
          : '';
    return `${segmentBtnBase} ${inactive}${hideSharedBorder}`;
  }

  return `${segmentBtnBase} ${activeAccent} relative z-10`;
}

export default function SearchResultsToolbar({
  resultCount,
  showCachedOnly,
  onShowCachedOnlyChange,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirToggle,
  addonOptions = [],
  addonId,
  onAddonIdChange,
  density = 'full',
  onDensityChange,
}) {
  const t = useTranslations('SearchResults');

  const sortOptions = [
    { value: 'default', label: t('sort.default') },
    { value: 'size', label: t('sort.size') },
    { value: 'resolution', label: t('sort.resolution') },
    { value: 'title', label: t('sort.title') },
  ];

  const sourceOptions = [
    { value: '', label: t('filters.allAddons') },
    ...addonOptions.map((a) => ({ value: a.addonId, label: a.addonName || a.addonId })),
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex flex-col gap-2.5 rounded-md border border-border/60 bg-surface/95 px-3 py-2.5 backdrop-blur-sm dark:border-border-dark/60 dark:bg-surface-dark/95 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark sm:text-base">
          {t('results', { count: resultCount })}
        </h2>
        <fieldset className="flex items-center gap-0" aria-label={t('density.group')}>
          <button
            type="button"
            aria-pressed={density === 'compact'}
            onClick={() => onDensityChange?.('compact')}
            className={`${densityBtnClass(density === 'compact', {
              segment: 'left',
              otherActive: density === 'full',
            })} rounded-r-none`}
          >
            {t('density.compact')}
          </button>
          <button
            type="button"
            aria-pressed={density === 'full'}
            onClick={() => onDensityChange?.('full')}
            className={`${densityBtnClass(density === 'full', {
              segment: 'right',
              otherActive: density === 'compact',
            })} -ml-px rounded-l-none`}
          >
            {t('density.full')}
          </button>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-primary-text/60 dark:text-primary-text-dark/60">
            {t('cachedOnly')}
          </span>
          <ToggleSwitch
            checked={showCachedOnly}
            onChange={onShowCachedOnlyChange}
            ariaLabel={t('cachedOnly')}
          />
        </div>

        {sourceOptions.length > 1 && (
          <Dropdown
            options={sourceOptions}
            value={addonId || ''}
            onChange={onAddonIdChange}
            className="w-full min-w-[8rem] sm:w-36"
          />
        )}

        <div className="flex items-center gap-1.5">
          <Dropdown
            options={sortOptions}
            value={sortKey}
            onChange={onSortKeyChange}
            className="w-full min-w-[8rem] sm:w-32"
          />
          {sortKey !== 'default' && (
            <button
              type="button"
              onClick={onSortDirToggle}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/80 text-sm hover:bg-surface-alt dark:border-border-dark/80 dark:hover:bg-surface-alt-dark"
              aria-label={sortDir === 'desc' ? 'Sort descending' : 'Sort ascending'}
            >
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
