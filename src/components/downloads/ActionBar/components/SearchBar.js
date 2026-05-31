'use client';

import { useCallback, useId, useRef } from 'react';
import { MagnifyingGlass, Times } from '@/components/icons';
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
    <div className={`relative min-w-0 ${className}`.trim()}>
      <label htmlFor={inputId} className="sr-only">
        {t('searchDownloadsAria', { itemType: itemTypePlural })}
      </label>
      <div
        className={`relative flex items-center rounded-lg border bg-surface-alt transition-colors duration-150 dark:bg-surface-alt-dark
          ${
            hasQuery
              ? 'border-accent/60 dark:border-accent-dark/60'
              : 'border-border dark:border-border-dark'
          }
          focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/25 dark:focus-within:border-accent-dark dark:focus-within:ring-accent-dark/25`}
      >
        <span
          className="pointer-events-none absolute left-2.5 flex shrink-0 text-primary-text/40 dark:text-primary-text-dark/40"
          aria-hidden
        >
          <MagnifyingGlass />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          enterKeyHint="search"
          role="searchbox"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent py-1.5 pl-9 pr-8 text-sm text-primary-text dark:text-primary-text-dark
            placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50
            focus:outline-none"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-1.5 flex size-6 shrink-0 items-center justify-center rounded
              text-primary-text/40 hover:text-primary-text dark:text-primary-text-dark/40 dark:hover:text-primary-text-dark
              focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40
              transition-colors"
            aria-label={t('clearSearch')}
          >
            <Times />
          </button>
        )}
      </div>
    </div>
  );
}
