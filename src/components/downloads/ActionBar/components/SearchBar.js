'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import MagnifyingGlass from '@/components/icons/MagnifyingGlass';
import Question from '@/components/icons/Question';
import Times from '@/components/icons/Times';
import Tooltip from '@/components/shared/Tooltip';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';

export default function SearchBar({ search, onSearchChange, itemTypePlural, className = '' }) {
  const t = useTranslations('SearchBar');
  const isMobile = useIsMobile();
  const inputId = useId();
  const inputRef = useRef(null);
  const [draft, setDraft] = useState(search);
  const lastEmittedRef = useRef(search);

  useEffect(() => {
    if (search !== lastEmittedRef.current) {
      setDraft(search);
      lastEmittedRef.current = search;
    }
  }, [search]);

  const placeholder = isMobile
    ? t('placeholderDownloadsShort')
    : t('placeholderDownloads', { itemType: itemTypePlural });

  const searchHelpContent = useMemo(
    () => (
      <div className="space-y-2 text-left text-xs leading-relaxed">
        <p>{t('searchDownloadsHelpIntro')}</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>{t('searchDownloadsHelpOr')}</li>
          <li>{t('searchDownloadsHelpAnd')}</li>
          <li>{t('searchDownloadsHelpPhrase')}</li>
          <li>{t('searchDownloadsHelpExclude')}</li>
        </ul>
        <p className="text-primary-text/70 dark:text-primary-text-dark/70">
          {t('searchDownloadsHelpCombine')}
        </p>
      </div>
    ),
    [t]
  );

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setDraft(value);
      lastEmittedRef.current = value;
      onSearchChange(value);
    },
    [onSearchChange]
  );

  const handleClear = useCallback(() => {
    setDraft('');
    lastEmittedRef.current = '';
    onSearchChange('');
  }, [onSearchChange]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && draft) {
        e.preventDefault();
        handleClear();
        inputRef.current?.blur();
      }
    },
    [draft, handleClear]
  );

  const hasQuery = Boolean(draft?.trim());

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`.trim()}>
      <div className="relative min-w-0 flex-1">
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
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className="w-full min-w-0 bg-transparent py-1.5 pl-9 pr-8 text-sm text-primary-text dark:text-primary-text-dark
            placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50
            focus:outline-none"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={handleClear}
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

      <Tooltip content={searchHelpContent} position="bottom">
        <button
          type="button"
          className="flex size-7 shrink-0 items-center justify-center rounded-md
            text-primary-text/40 hover:bg-surface-alt hover:text-primary-text
            dark:text-primary-text-dark/40 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark
            focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40
            transition-colors"
          aria-label={t('searchDownloadsHelpAria')}
        >
          <Question className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}
