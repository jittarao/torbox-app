'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/store/searchStore';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import { useSearchFilterParams } from '@/hooks/useSearchFilterParams';
import { MagnifyingGlass, Times, Filter } from '@/components/icons';
import { useTranslations } from 'next-intl';
import Dropdown from '@/components/shared/Dropdown';
import SearchBarDropdowns from './SearchBarDropdowns';
import { collectInstalledPrefixes } from '@/utils/stremioMediaId';
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

export default function SearchBar() {
  const t = useTranslations('SearchBar');
  const [localQuery, setLocalQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);

  const { setQuery, clearResults, searchHistory, loadHistory, clearHistory, validationError } =
    useSearchStore(
      useShallow((s) => ({
        setQuery: s.setQuery,
        clearResults: s.clearResults,
        searchHistory: s.searchHistory,
        loadHistory: s.loadHistory,
        clearHistory: s.clearHistory,
        validationError: s.validationError,
      }))
    );

  const addons = useStremioAddonsStore((s) => s.addons);
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
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowHistory(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    const q = localQuery.trim();
    if (!q) return;
    setShowHistory(false);
    setShowSuggestions(false);
    setQuery(q);
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
                  setShowHistory(true);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  setShowHistory(true);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder={t('placeholderSearch')}
                className="w-full rounded-md border border-border/80 bg-surface-alt/50 py-2.5 pl-10 pr-9 text-sm text-primary-text placeholder:text-primary-text/35 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 dark:border-border-dark/80 dark:bg-surface-alt-dark/50 dark:text-primary-text-dark dark:placeholder:text-primary-text-dark/35 dark:focus:border-accent-dark/50 dark:focus:ring-accent-dark/30"
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

          <SearchBarDropdowns
            showHistory={showHistory && searchHistory.length > 0}
            showSuggestions={showSuggestions}
            searchHistory={searchHistory}
            suggestions={suggestions}
            onSelectHistory={(item) => {
              setLocalQuery(item);
              setShowHistory(false);
              setShowSuggestions(false);
              setQuery(item);
            }}
            onSelectSuggestion={(id) => {
              setLocalQuery(id);
              setShowHistory(false);
              setShowSuggestions(false);
              setQuery(id);
            }}
            onClearHistory={clearHistory}
          />
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
