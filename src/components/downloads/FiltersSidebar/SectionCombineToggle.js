'use client';

import { useTranslations } from 'next-intl';
import { COMBINE_MODES } from '@/components/downloads/filters/sidebarCombineMode';

export default function SectionCombineToggle({
  value = COMBINE_MODES.ANY,
  onChange,
  disabled = false,
  sectionLabel,
}) {
  const t = useTranslations('DownloadsFilters');
  const isAll = value === COMBINE_MODES.ALL;

  return (
    <div
      role="group"
      aria-label={t('combineToggleLabel', { section: sectionLabel })}
      className={`inline-flex shrink-0 overflow-hidden rounded-md border border-border/50 text-[10px] font-semibold uppercase tracking-wide dark:border-border-dark/50 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(COMBINE_MODES.ANY)}
        aria-pressed={!isAll}
        aria-label={t('combineModeAny', { section: sectionLabel })}
        className={`px-1.5 py-0.5 transition-colors ${
          !isAll
            ? 'bg-accent/15 text-accent dark:bg-accent-dark/20 dark:text-accent-dark'
            : 'text-primary-text/45 hover:bg-surface-alt/70 dark:text-primary-text-dark/45 dark:hover:bg-surface-alt-dark/50'
        }`}
      >
        {t('combineAny')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(COMBINE_MODES.ALL)}
        aria-pressed={isAll}
        aria-label={t('combineModeAll', { section: sectionLabel })}
        className={`border-l border-border/50 px-1.5 py-0.5 transition-colors dark:border-border-dark/50 ${
          isAll
            ? 'bg-accent/15 text-accent dark:bg-accent-dark/20 dark:text-accent-dark'
            : 'text-primary-text/45 hover:bg-surface-alt/70 dark:text-primary-text-dark/45 dark:hover:bg-surface-alt-dark/50'
        }`}
      >
        {t('combineAll')}
      </button>
    </div>
  );
}
