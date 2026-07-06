'use client';

import { useTranslations } from 'next-intl';

function SearchIcon({ className = 'size-3.5' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

export default function FiltersSidebarSearch({ value, onChange }) {
  const t = useTranslations('DownloadsFilters');

  return (
    <div className="relative mb-2 shrink-0 px-0.5">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('sidebarSearchPlaceholder')}
        aria-label={t('sidebarSearchPlaceholder')}
        className="w-full rounded-lg border border-border/60 bg-white/50 py-1.5 pl-8 pr-2 text-xs text-primary-text placeholder:text-primary-text/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10 dark:border-border-dark/60 dark:bg-white/[0.04] dark:text-primary-text-dark dark:placeholder:text-primary-text-dark/40 dark:focus:border-accent-dark/40 dark:focus:ring-accent-dark/10"
      />
    </div>
  );
}
