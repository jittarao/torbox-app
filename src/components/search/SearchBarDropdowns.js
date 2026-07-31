'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { tmdbPosterUrl, historyEntryKey } from '@/utils/tmdbSearchQuery';
import { Times } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';

function HistoryRowContent({ entry, tmdbConfigured, tTmdb }) {
  if (tmdbConfigured && entry?.kind === 'tmdb') {
    const poster = tmdbPosterUrl(entry.posterPath);
    return (
      <span className="flex w-full items-center gap-2.5">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            referrerPolicy="no-referrer"
            className="h-12 w-8 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface-alt text-[10px] text-primary-text/40 dark:bg-surface-alt-dark dark:text-primary-text-dark/40">
            —
          </div>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.title}</span>
          <span className="block text-xs text-primary-text/50 dark:text-primary-text-dark/50">
            {entry.mediaType === 'tv' ? tTmdb('typeTv') : tTmdb('typeMovie')}
            {entry.year ? ` · ${entry.year}` : ''}
            {entry.imdbId ? ` · ${entry.imdbId}` : ''}
          </span>
        </span>
      </span>
    );
  }

  const streamId = typeof entry === 'string' ? entry : entry?.streamId;
  return <span className="font-mono">{streamId}</span>;
}

function HistorySection({
  searchHistory,
  tmdbConfigured,
  t,
  tTmdb,
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
}) {
  return (
    <div className="border-b border-border p-2 dark:border-border-dark">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-xs font-medium text-primary-text/60 dark:text-primary-text-dark/60">
          {t('recentSearches')}
        </span>
        <button
          type="button"
          onClick={onClearHistory}
          className="text-xs text-accent hover:underline dark:text-accent-dark"
        >
          {t('clearHistory')}
        </button>
      </div>
      <ul className="space-y-0.5">
        {searchHistory.map((item) => (
          <li
            key={historyEntryKey(item) || item?.streamId || String(item)}
            className="group flex items-center gap-0.5 rounded-md pr-0.5 transition-colors hover:bg-surface-alt/80 dark:hover:bg-surface-alt-dark/80"
          >
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm text-primary-text dark:text-primary-text-dark"
              onClick={() => onSelectHistory(item)}
            >
              <HistoryRowContent entry={item} tmdbConfigured={tmdbConfigured} tTmdb={tTmdb} />
            </button>
            <button
              type="button"
              onClick={() => onRemoveHistory(item)}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-primary-text/35 transition-all
                hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100
                dark:text-primary-text-dark/35 dark:hover:bg-red-500/15 dark:hover:text-red-400
                sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              aria-label={t('removeSearch')}
              title={t('removeSearch')}
            >
              <Times className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TitleSection({ titleResults, titleLoading, titleHint, tTmdb, onSelectTitle }) {
  return (
    <div className="border-b border-border p-2 dark:border-border-dark">
      <div className="mb-1 px-2 text-xs font-medium text-primary-text/60 dark:text-primary-text-dark/60">
        {tTmdb('titleSuggestions')}
      </div>
      {titleHint ? (
        <p className="px-2 py-1.5 text-sm text-primary-text/60 dark:text-primary-text-dark/60">
          {titleHint}
        </p>
      ) : null}
      {titleLoading ? (
        <div className="flex justify-center py-3">
          <Spinner size="sm" className="text-accent dark:text-accent-dark" />
        </div>
      ) : null}
      {!titleLoading && Array.isArray(titleResults) && titleResults.length > 0 ? (
        <ul>
          {titleResults.map((item) => {
            const poster = tmdbPosterUrl(item.posterPath);
            return (
              <li key={`${item.mediaType}-${item.tmdbId}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                  onClick={() => onSelectTitle(item)}
                >
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-12 w-8 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-surface-alt text-[10px] text-primary-text/40 dark:bg-surface-alt-dark dark:text-primary-text-dark/40">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.title}</div>
                    <div className="text-xs text-primary-text/50 dark:text-primary-text-dark/50">
                      {item.mediaType === 'tv' ? tTmdb('typeTv') : tTmdb('typeMovie')}
                      {item.year ? ` · ${item.year}` : ''}
                      {item.imdbId ? ` · ${item.imdbId}` : ''}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!titleLoading && !titleHint && Array.isArray(titleResults) && titleResults.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-primary-text/55 dark:text-primary-text-dark/55">
          {tTmdb('noResults')}
        </p>
      ) : null}
    </div>
  );
}

export default function SearchBarDropdowns({
  showHistory,
  showSuggestions,
  searchHistory,
  suggestions,
  titleResults,
  titleLoading,
  titleHint,
  tmdbConfigured = false,
  onSelectHistory,
  onRemoveHistory,
  onSelectSuggestion,
  onSelectTitle,
  onClearHistory,
}) {
  const t = useTranslations('SearchBar');
  const tTmdb = useTranslations('TmdbSearch');

  const showTitleSection =
    Boolean(titleHint) || titleLoading || (Array.isArray(titleResults) && titleResults.length > 0);

  const showHistorySection = showHistory && searchHistory.length > 0;

  const dropdownRef = useRef(null);
  const [maxHeight, setMaxHeight] = useState(null);

  useEffect(() => {
    const updateMaxHeight = () => {
      const el = dropdownRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const margin = 16;
      setMaxHeight(Math.max(200, window.innerHeight - top - margin));
    };

    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    window.addEventListener('scroll', updateMaxHeight, true);
    return () => {
      window.removeEventListener('resize', updateMaxHeight);
      window.removeEventListener('scroll', updateMaxHeight, true);
    };
  }, [showHistorySection, showSuggestions, showTitleSection]);

  if (!showHistorySection && !showSuggestions && !showTitleSection) return null;

  return (
    <div
      ref={dropdownRef}
      style={maxHeight != null ? { maxHeight } : undefined}
      className="absolute left-0 right-0 z-50 mt-1 overflow-y-auto rounded-md border border-border bg-white shadow-lg dark:border-border-dark dark:bg-[#1a1a1d]"
    >
      {showTitleSection ? (
        <TitleSection
          titleResults={titleResults}
          titleLoading={titleLoading}
          titleHint={titleHint}
          tTmdb={tTmdb}
          onSelectTitle={onSelectTitle}
        />
      ) : null}

      {showHistorySection ? (
        <HistorySection
          searchHistory={searchHistory}
          tmdbConfigured={tmdbConfigured}
          t={t}
          tTmdb={tTmdb}
          onSelectHistory={onSelectHistory}
          onRemoveHistory={onRemoveHistory}
          onClearHistory={onClearHistory}
        />
      ) : null}

      {showSuggestions && suggestions.length > 0 && (
        <div className="p-2">
          <div className="mb-1 px-2 text-xs font-medium text-primary-text/60 dark:text-primary-text-dark/60">
            {t('searchExamples')}
          </div>
          <ul>
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-primary-text hover:bg-surface-alt dark:text-primary-text-dark dark:hover:bg-surface-alt-dark"
                  onClick={() => onSelectSuggestion(item.id)}
                >
                  <span className="font-mono">{item.id}</span>
                  {item.label ? (
                    <span className="ml-2 text-primary-text/50 dark:text-primary-text-dark/50">
                      {item.label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
