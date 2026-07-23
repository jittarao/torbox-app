'use client';

import { useTranslations } from 'next-intl';

const collapseToggleClassName =
  'flex size-7 items-center justify-center rounded-lg border border-border/50 bg-white/60 text-primary-text/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-colors transition-shadow transition-transform duration-200 group-hover:border-accent/35 group-hover:bg-accent/[0.07] group-hover:text-accent group-hover:shadow-[0_1px_3px_rgba(217,119,6,0.12)] group-active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-primary-text-dark/55 dark:group-hover:border-accent-dark/40 dark:group-hover:bg-accent-dark/10 dark:group-hover:text-accent-dark';

export function FiltersSidebarHeader({ collapsed, onToggle, compact = false }) {
  const t = useTranslations('DownloadsFilters');
  const label = t('sidebarLabel');
  const toggleLabel = collapsed ? t('expandSidebar') : t('collapseSidebar');

  const filterIcon = (
    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );

  const collapseChevron = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.25}
      stroke="currentColor"
      className={`size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        collapsed ? 'rotate-180' : ''
      }`}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );

  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="group flex w-full flex-col items-center gap-2 border-b border-border/50 px-1 py-3 transition-colors hover:bg-surface-alt/40 dark:border-border-dark/50 dark:hover:bg-surface-alt-dark/30"
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15 dark:bg-accent-dark/15 dark:text-accent-dark dark:group-hover:bg-accent-dark/20"
          aria-hidden
        >
          {filterIcon}
        </span>
        <span
          className="max-h-[4.5rem] truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-text/50 dark:text-primary-text-dark/50"
          style={{ writingMode: 'vertical-rl' }}
          aria-hidden
        >
          {label}
        </span>
        <span className={collapseToggleClassName} aria-hidden>
          {collapseChevron}
        </span>
      </button>
    );
  }

  return (
    <div className="mb-2.5 flex shrink-0 items-center gap-2 border-b border-border/50 pb-2.5 dark:border-border-dark/50">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent dark:bg-accent-dark/15 dark:text-accent-dark"
          aria-hidden
        >
          {filterIcon}
        </span>
        <h2 className="truncate text-sm font-semibold tracking-tight text-primary-text dark:text-primary-text-dark">
          {label}
        </h2>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="group shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40"
      >
        <span className={collapseToggleClassName} aria-hidden>
          {collapseChevron}
        </span>
      </button>
    </div>
  );
}
