'use client';

import { useCallback, useId, useRef } from 'react';
import Icons from '@/components/icons';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';

export default function SearchBar({ search, onSearchChange, itemTypePlural, className = '' }) {
  const t = useTranslations('SearchBar');
  const isMobile = useIsMobile();
  const inputId = useId();
  const inputRef = useRef(null);

  const placeholder = isMobile
    ? t('placeholderDownloadsShort')
    : t('placeholderDownloads', { itemType: itemTypePlural });

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && search) {
        e.preventDefault();
        onSearchChange('');
        inputRef.current?.blur();
      }
    },
    [search, onSearchChange]
  );

  const hasQuery = Boolean(search?.trim());

  return (
    <div className={`relative min-w-0 w-full ${className}`.trim()}>
      <label htmlFor={inputId} className="sr-only">
        {t('searchDownloadsAria', { itemType: itemTypePlural })}
      </label>
      <div
        className={`relative flex items-center rounded-xl border bg-surface-alt dark:bg-surface-alt-dark shadow-sm transition-[border-color,box-shadow] duration-200
          ${
            hasQuery
              ? 'border-accent/50 dark:border-accent-dark/50 ring-2 ring-accent/15 dark:ring-accent-dark/15'
              : 'border-border dark:border-border-dark hover:border-primary-text/25 dark:hover:border-primary-text-dark/25'
          }
          focus-within:border-accent dark:focus-within:border-accent-dark focus-within:ring-2 focus-within:ring-accent/20 dark:focus-within:ring-accent-dark/20`}
      >
        <span
          className="pointer-events-none absolute left-3 flex shrink-0 text-primary-text/45 dark:text-primary-text-dark/45"
          aria-hidden
        >
          <Icons.MagnifyingGlass />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent py-2.5 pl-10 pr-10 text-sm text-primary-text dark:text-primary-text-dark
            placeholder:text-primary-text/45 dark:placeholder:text-primary-text-dark/45
            focus:outline-none sm:py-2"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
              text-primary-text/50 dark:text-primary-text-dark/50
              hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark
              hover:text-primary-text dark:hover:text-primary-text-dark
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 dark:focus-visible:ring-accent-dark/30
              transition-colors"
            aria-label={t('clearSearch')}
          >
            <Icons.Times />
          </button>
        )}
      </div>
    </div>
  );
}
