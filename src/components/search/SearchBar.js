'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/store/searchStore';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import { useTmdbCredentialsStore } from '@/store/tmdbCredentialsStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSearchFilterParams } from '@/hooks/useSearchFilterParams';
import { MagnifyingGlass, Times, Filter } from '@/components/icons';
import { useTranslations } from 'next-intl';
import Dropdown from '@/components/shared/Dropdown';
import SearchBarDropdowns from './SearchBarDropdowns';
import EpisodePicker from './EpisodePicker';
import { collectInstalledPrefixes } from '@/utils/stremioMediaId';
import {
  classifySearchQuery,
  enabledAddonsSupportTmdbPrefix,
  isFullImdbId,
  suggestionToHistoryEntry,
  mediaTypeToStreamTypes,
} from '@/utils/tmdbSearchQuery';
import { getItem } from '@/utils/storage';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import {
  RESOLUTION_OPTIONS,
  CODEC_OPTIONS,
  HDR_OPTIONS,
  LANGUAGE_OPTIONS,
  MIN_SIZE_OPTIONS,
  MAX_SIZE_OPTIONS,
} from './searchFilterOptions';

const EXAMPLE_IDS = [
  { id: 'tt0111161', labelKey: 'examples.movie' },
  { id: 'tt0944947:1:1', labelKey: 'examples.episode' },
  { id: 'anilist:16498', labelKey: 'examples.anime' },
];

/** Trailing debounce for TMDB title suggestions — longer than typical inter-keystroke gaps. */
const TITLE_SEARCH_DEBOUNCE_MS = 600;
const MIN_FREE_TEXT_LEN = 2;

function toDropdownOptions(presets, t) {
  return presets.map((opt) => ({
    value: opt.value,
    label: opt.labelKey ? t(opt.labelKey) : opt.label,
  }));
}

function FilterField({ label, children }) {
  return (
    <label className="min-w-0 text-xs">
      <span className="mb-1 block font-medium text-primary-text/55 dark:text-primary-text-dark/55">
        {label}
      </span>
      {children}
    </label>
  );
}

function getApiKey() {
  return useSessionStore.getState().apiKey || getItem('torboxApiKey');
}

export default function SearchBar() {
  const t = useTranslations('SearchBar');
  const tTmdb = useTranslations('TmdbSearch');
  const [localQuery, setLocalQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [titleResults, setTitleResults] = useState([]);
  const [titleLoading, setTitleLoading] = useState(false);
  const [titleHint, setTitleHint] = useState(null);
  const [episodePick, setEpisodePick] = useState(null);
  const searchRef = useRef(null);
  const titleAbortRef = useRef(null);

  const {
    setQuery,
    clearResults,
    searchHistory,
    loadHistory,
    clearHistory,
    removeFromHistory,
    validationError,
    pendingEpisodePick,
    clearPendingEpisodePick,
  } = useSearchStore(
    useShallow((s) => ({
      setQuery: s.setQuery,
      clearResults: s.clearResults,
      searchHistory: s.searchHistory,
      loadHistory: s.loadHistory,
      clearHistory: s.clearHistory,
      removeFromHistory: s.removeFromHistory,
      validationError: s.validationError,
      pendingEpisodePick: s.pendingEpisodePick,
      clearPendingEpisodePick: s.clearPendingEpisodePick,
    }))
  );

  const addons = useStremioAddonsStore((s) => s.addons);
  const tmdbConfigured = useTmdbCredentialsStore((s) => s.configured);
  const tmdbHasLoaded = useTmdbCredentialsStore((s) => s.hasLoaded);

  const {
    resolution,
    codec,
    hdr,
    language,
    minSizeGb,
    maxSizeGb,
    streamTypes,
    setResolution,
    setCodec,
    setHdr,
    setLanguage,
    setMinSizeGb,
    setMaxSizeGb,
    clearFilters,
  } = useSearchFilterParams();

  const suggestions = useMemo(() => {
    const prefixes = new Set(collectInstalledPrefixes(addons));
    return EXAMPLE_IDS.filter((ex) => {
      if (ex.id.startsWith('tt')) return prefixes.has('tt');
      const prefix = ex.id.split(':')[0];
      return prefixes.has(prefix);
    }).map((ex) => ({
      id: ex.id,
      label: t(ex.labelKey),
    }));
  }, [addons, t]);

  const resolutionOptions = useMemo(() => toDropdownOptions(RESOLUTION_OPTIONS, t), [t]);
  const codecOptions = useMemo(() => toDropdownOptions(CODEC_OPTIONS, t), [t]);
  const hdrOptions = useMemo(() => toDropdownOptions(HDR_OPTIONS, t), [t]);
  const languageOptions = useMemo(() => toDropdownOptions(LANGUAGE_OPTIONS, t), [t]);
  const minSizeOptions = useMemo(() => toDropdownOptions(MIN_SIZE_OPTIONS, t), [t]);
  const maxSizeOptions = useMemo(() => toDropdownOptions(MAX_SIZE_OPTIONS, t), [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!pendingEpisodePick) return;
    setEpisodePick(pendingEpisodePick);
    setLocalQuery(pendingEpisodePick.title || pendingEpisodePick.streamId || '');
    setShowHistory(false);
    setShowSuggestions(false);
    clearPendingEpisodePick();
  }, [pendingEpisodePick, clearPendingEpisodePick]);

  useEffect(() => {
    const dismissOverlays = () => {
      setShowHistory(false);
      setShowSuggestions(false);
      setEpisodePick(null);
    };
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        dismissOverlays();
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') dismissOverlays();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Debounced TMDB title search (free text) or find (full IMDb id)
  useEffect(() => {
    const kind = classifySearchQuery(localQuery);
    titleAbortRef.current?.abort();
    titleAbortRef.current = null;

    const q = localQuery.trim();
    const fullImdb = isFullImdbId(q);
    const freeText = kind === 'free_text' && q.length >= MIN_FREE_TEXT_LEN;

    if (!freeText && !fullImdb) {
      setTitleResults([]);
      setTitleLoading(false);
      setTitleHint(null);
      return;
    }

    if (tmdbHasLoaded && !tmdbConfigured) {
      setTitleResults([]);
      setTitleLoading(false);
      // Free text prompts to configure; IMDb id has no suggestion path without a key
      setTitleHint(freeText ? tTmdb('configureKeyHint') : null);
      return;
    }

    if (!tmdbConfigured) {
      setTitleResults([]);
      setTitleLoading(false);
      setTitleHint(null);
      return;
    }

    setTitleHint(null);
    const timer = setTimeout(async () => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setTitleLoading(false);
        setTitleHint(tTmdb('configureKeyHint'));
        return;
      }

      const controller = new AbortController();
      titleAbortRef.current = controller;
      setTitleLoading(true);

      const allowTmdbFallback = enabledAddonsSupportTmdbPrefix(addons);

      try {
        if (fullImdb) {
          const params = new URLSearchParams({ imdbId: q.toLowerCase() });
          if (allowTmdbFallback) params.set('allowTmdbFallback', '1');

          const res = await fetch(`/api/tmdb/find?${params}`, {
            headers: { 'x-api-key': apiKey },
            signal: controller.signal,
          });
          const { ok, data } = await readJsonFromResponse(res);
          if (controller.signal.aborted) return;

          if (data.code === 'TMDB_NOT_CONFIGURED' || data.code === 'TMDB_INVALID_KEY') {
            setTitleResults([]);
            setTitleHint(
              data.code === 'TMDB_INVALID_KEY' ? tTmdb('invalidKeyHint') : tTmdb('configureKeyHint')
            );
            setTitleLoading(false);
            return;
          }

          if (!ok || data.success === false || !data.result) {
            setTitleResults([]);
            // 404 / empty result: no hint; other failures mirror free-text searchFailed
            const isMiss = res.status === 404 || (ok && data.success && !data.result);
            setTitleHint(isMiss ? null : data.error || tTmdb('searchFailed'));
            setTitleLoading(false);
            return;
          }

          setTitleResults([data.result]);
          setTitleHint(null);
          setTitleLoading(false);
          return;
        }

        const params = new URLSearchParams({ q });
        if (allowTmdbFallback) params.set('allowTmdbFallback', '1');

        const res = await fetch(`/api/tmdb/search?${params}`, {
          headers: { 'x-api-key': apiKey },
          signal: controller.signal,
        });
        const { ok, data } = await readJsonFromResponse(res);
        if (controller.signal.aborted) return;

        if (data.code === 'TMDB_NOT_CONFIGURED' || data.code === 'TMDB_INVALID_KEY') {
          setTitleResults([]);
          setTitleHint(
            data.code === 'TMDB_INVALID_KEY' ? tTmdb('invalidKeyHint') : tTmdb('configureKeyHint')
          );
          setTitleLoading(false);
          return;
        }

        if (!ok || data.success === false) {
          setTitleResults([]);
          setTitleHint(data.error || tTmdb('searchFailed'));
          setTitleLoading(false);
          return;
        }

        setTitleResults(Array.isArray(data.results) ? data.results : []);
        setTitleHint(null);
        setTitleLoading(false);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setTitleResults([]);
        setTitleHint(tTmdb('searchFailed'));
        setTitleLoading(false);
      }
    }, TITLE_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      titleAbortRef.current?.abort();
      titleAbortRef.current = null;
    };
  }, [localQuery, tmdbConfigured, tmdbHasLoaded, addons, tTmdb]);

  const runMediaIdSearch = (id, options = {}) => {
    setLocalQuery(id);
    setShowHistory(false);
    setShowSuggestions(false);
    setEpisodePick(null);
    setTitleResults([]);
    setTitleHint(null);
    setQuery(id, options);
  };

  const handleSelectTitle = (item) => {
    if (item.mediaType === 'tv') {
      setLocalQuery(item.title || item.streamId || '');
      setEpisodePick(item);
      setShowHistory(false);
      setShowSuggestions(false);
      return;
    }
    const meta = suggestionToHistoryEntry(item);
    runMediaIdSearch(item.streamId, {
      types: mediaTypeToStreamTypes(item.mediaType) || ['movie'],
      historyMeta: meta,
    });
  };

  const handleSearch = () => {
    const q = localQuery.trim();
    if (!q) return;

    const kind = classifySearchQuery(q);
    if (kind === 'media_id') {
      if (isFullImdbId(q) && titleResults.length === 1 && !titleLoading) {
        handleSelectTitle(titleResults[0]);
        return;
      }
      setShowHistory(false);
      setShowSuggestions(false);
      setEpisodePick(null);
      setQuery(q);
      return;
    }

    // Free text: select sole suggestion, else keep dropdown open
    if (titleResults.length === 1 && !titleLoading) {
      handleSelectTitle(titleResults[0]);
      return;
    }

    setShowHistory(true);
    setShowSuggestions(true);
    if (tmdbHasLoaded && !tmdbConfigured) {
      setTitleHint(tTmdb('configureKeyHint'));
    }
  };

  const validationMessage = (() => {
    if (!validationError) return null;
    if (validationError === 'empty') return t('validation.empty');
    if (validationError === 'invalid') return t('validation.invalid');
    if (validationError === 'unknown_prefix') return t('validation.unknownPrefix');
    if (validationError === 'no_addons') return t('validation.noAddons');
    if (validationError === 'no_matching_addons') return t('validation.noMatchingAddons');
    if (validationError === 'addons_loading') return t('validation.addonsLoading');
    return t('validation.invalid');
  })();

  const hasActiveFilters = Boolean(
    resolution || codec || hdr || language || minSizeGb || maxSizeGb || streamTypes.length > 0
  );
  const activeFilterCount =
    [resolution, codec, hdr, language, minSizeGb, maxSizeGb].filter(Boolean).length +
    streamTypes.length;

  const queryKind = classifySearchQuery(localQuery);
  const showTitleDropdown =
    (queryKind === 'free_text' && localQuery.trim().length >= MIN_FREE_TEXT_LEN) ||
    (tmdbConfigured && isFullImdbId(localQuery));

  return (
    <section
      className="relative z-20 rounded-lg border border-border/70 bg-surface dark:border-border-dark/70 dark:bg-surface-dark"
      ref={searchRef}
    >
      <div className="p-3 sm:p-4">
        <div className="relative z-40">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => {
                  setLocalQuery(e.target.value);
                  setEpisodePick(null);
                  setShowHistory(true);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setShowHistory(true);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder={t('placeholderSearch')}
                className="w-full rounded-md border border-border/80 bg-surface-alt/50 py-2.5 pl-10 pr-9 text-sm text-primary-text placeholder:text-primary-text/35 focus:border-accent/50 focus:outline-hidden focus:ring-1 focus:ring-accent/30 dark:border-border-dark/80 dark:bg-surface-alt-dark/50 dark:text-primary-text-dark dark:placeholder:text-primary-text-dark/35 dark:focus:border-accent-dark/50 dark:focus:ring-accent-dark/30"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35" />
              {localQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-primary-text/40 hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/40 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
                  onClick={() => {
                    setLocalQuery('');
                    setEpisodePick(null);
                    setTitleResults([]);
                    setTitleHint(null);
                    clearResults();
                  }}
                  aria-label={t('clearSearch')}
                >
                  <Times className="size-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              className="shrink-0 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
            >
              {t('search')}
            </button>
          </div>

          {!episodePick ? (
            <SearchBarDropdowns
              showHistory={showHistory && searchHistory.length > 0}
              showSuggestions={showSuggestions && !showTitleDropdown}
              searchHistory={searchHistory}
              suggestions={suggestions}
              titleResults={showSuggestions && showTitleDropdown ? titleResults : []}
              titleLoading={showSuggestions && showTitleDropdown && titleLoading}
              titleHint={showSuggestions && showTitleDropdown ? titleHint : null}
              tmdbConfigured={tmdbConfigured}
              onSelectHistory={(entry) => {
                if (tmdbConfigured && entry?.kind === 'tmdb' && entry.mediaType === 'tv') {
                  setLocalQuery(entry.title || entry.streamId || '');
                  setEpisodePick(entry);
                  setShowHistory(false);
                  setShowSuggestions(false);
                  return;
                }
                if (tmdbConfigured && entry?.kind === 'tmdb' && entry.mediaType === 'movie') {
                  runMediaIdSearch(entry.streamId, {
                    types: ['movie'],
                    historyMeta: entry,
                  });
                  return;
                }
                const streamId = typeof entry === 'string' ? entry : entry?.streamId;
                if (streamId) runMediaIdSearch(streamId);
              }}
              onSelectSuggestion={(id) => {
                runMediaIdSearch(id);
              }}
              onSelectTitle={handleSelectTitle}
              onClearHistory={clearHistory}
              onRemoveHistory={removeFromHistory}
            />
          ) : null}

          {episodePick ? (
            <EpisodePicker
              suggestion={episodePick}
              onConfirm={(streamId, suggestion) => {
                setEpisodePick(null);
                runMediaIdSearch(streamId, {
                  types: ['series'],
                  historyMeta: suggestionToHistoryEntry(suggestion),
                });
              }}
              onCancel={() => setEpisodePick(null)}
            />
          ) : null}
        </div>

        {validationMessage && (
          <p className="mt-2.5 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {validationMessage}
          </p>
        )}
      </div>

      <div className="relative z-0 border-t border-border/60 px-3 py-3 dark:border-border-dark/60 sm:px-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-primary-text/65 dark:text-primary-text-dark/65">
            <Filter className="size-3.5" />
            {t('streamFilters')}
            {hasActiveFilters ? (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent dark:bg-accent-dark/20 dark:text-accent-dark">
                {activeFilterCount}
              </span>
            ) : null}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-accent hover:underline dark:text-accent-dark"
            >
              {t('clearFilters')}
            </button>
          ) : null}
        </div>

        <div className="relative z-30 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <FilterField label={t('filters.resolution')}>
            <Dropdown
              options={resolutionOptions}
              value={resolution}
              onChange={setResolution}
              className="w-full"
            />
          </FilterField>
          <FilterField label={t('filters.codec')}>
            <Dropdown options={codecOptions} value={codec} onChange={setCodec} className="w-full" />
          </FilterField>
          <FilterField label={t('filters.hdr')}>
            <Dropdown options={hdrOptions} value={hdr} onChange={setHdr} className="w-full" />
          </FilterField>
          <FilterField label={t('filters.language')}>
            <Dropdown
              options={languageOptions}
              value={language}
              onChange={setLanguage}
              className="w-full"
            />
          </FilterField>
          <FilterField label={t('filters.minSize')}>
            <Dropdown
              options={minSizeOptions}
              value={minSizeGb}
              onChange={setMinSizeGb}
              className="w-full"
            />
          </FilterField>
          <FilterField label={t('filters.maxSize')}>
            <Dropdown
              options={maxSizeOptions}
              value={maxSizeGb}
              onChange={setMaxSizeGb}
              className="w-full"
            />
          </FilterField>
        </div>
      </div>
    </section>
  );
}
