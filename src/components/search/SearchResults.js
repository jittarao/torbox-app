'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/store/searchStore';
import { selectDisplayResults } from '@/store/searchSelectors';
import { useSearchFilterParams } from '@/hooks/useSearchFilterParams';
import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import { useUpload } from '@/components/shared/hooks/useUpload';
import { streamToUploadTarget, triggerSilentStreamAdd } from '@/utils/stremioStreamNormalize';
import { getItem, setItem } from '@/utils/storage';
import SearchResultsToolbar from './SearchResultsToolbar';
import SearchResultRow from './SearchResultRow';

const DENSITY_STORAGE_KEY = 'torboxSearchResultDensity';

function statusLabel(status, t) {
  if (status === 'pending') return t('addonStatus.pending');
  if (status === 'ok') return t('addonStatus.ok');
  if (status === 'empty') return t('addonStatus.empty');
  if (status === 'error') return t('addonStatus.error');
  return status;
}

const STATUS_ACTIVE = {
  ok: 'border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-400',
  error: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400',
  empty:
    'border-border/70 bg-surface-alt text-primary-text/65 dark:border-border-dark/70 dark:bg-surface-alt-dark dark:text-primary-text-dark/65',
  pending:
    'border-accent/30 bg-accent/10 text-accent dark:border-accent-dark/30 dark:bg-accent-dark/15 dark:text-accent-dark',
};

const STATUS_INACTIVE =
  'border-border/40 bg-transparent text-primary-text/40 dark:border-border-dark/40 dark:text-primary-text-dark/40';

function readStoredDensity() {
  const stored = getItem(DENSITY_STORAGE_KEY);
  return stored === 'compact' || stored === 'full' ? stored : 'full';
}

export default function SearchResults({ apiKey }) {
  const searchState = useSearchStore(
    useShallow((s) => ({
      query: s.query,
      hasSearchCompleted: s.hasSearchCompleted,
      results: s.results,
      loading: s.loading,
      error: s.error,
      validationError: s.validationError,
      addonStatuses: s.addonStatuses,
      clearResults: s.clearResults,
    }))
  );
  const {
    query,
    hasSearchCompleted,
    results,
    loading,
    error,
    validationError,
    addonStatuses,
    clearResults,
  } = searchState;

  const { streamFilters, addonId, setAddonId, streamTypes, toggleStreamType } =
    useSearchFilterParams();
  const { uploadItem } = useUpload(apiKey, 'torrents');
  const [sortKey, setSortKey] = useState('default');
  const [sortDir, setSortDir] = useState('desc');
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState({});
  const [showCachedOnly, setShowCachedOnly] = useState(false);
  const [addedItems, setAddedItems] = useState([]);
  const [density, setDensity] = useState(readStoredDensity);
  const t = useTranslations('SearchResults');

  const filters = useMemo(
    () => ({
      ...streamFilters,
      showCachedOnly,
      addonId: addonId || streamFilters.addonId || '',
    }),
    [streamFilters, showCachedOnly, addonId]
  );

  const displayResults = useMemo(
    () => selectDisplayResults(results, filters, sortKey, sortDir),
    [results, filters, sortKey, sortDir]
  );

  const addonOptions = useMemo(() => {
    const map = new Map();
    for (const s of addonStatuses) {
      if (s.addonId && !map.has(s.addonId)) {
        map.set(s.addonId, { addonId: s.addonId, addonName: s.addonName });
      }
    }
    return [...map.values()];
  }, [addonStatuses]);

  useEffect(() => {
    clearResults();
    setAddedItems([]);
  }, [apiKey, clearResults]);

  const handleDensityChange = (next) => {
    setDensity(next);
    setItem(DENSITY_STORAGE_KEY, next);
  };

  const copyLink = async (item) => {
    const target = streamToUploadTarget(item);
    if (!target.copyValue) return;
    try {
      await navigator.clipboard.writeText(target.copyValue);
      const toastKey =
        target.kind === 'magnet'
          ? 'toast.magnetCopied'
          : target.kind === 'usenet'
            ? 'toast.nzbCopied'
            : 'toast.linkCopied';
      setToast({
        message: t(toastKey),
        type: 'success',
      });
    } catch {
      setToast({
        message: t('toast.copyFailed'),
        type: 'error',
      });
    }
  };

  const handleUpload = async (item) => {
    const target = streamToUploadTarget(item);
    if (!target.canUpload && !target.canSilentAdd) return;

    setIsUploading((prev) => ({ ...prev, [item.key]: true }));
    try {
      if (target.kind === 'link' && target.canSilentAdd) {
        await triggerSilentStreamAdd(target.data, apiKey);
        setAddedItems((prev) => [...prev, item.key]);
        setToast({
          message: t('toast.linkAdded'),
          type: 'success',
        });
        return;
      }

      let result;
      if (target.kind === 'magnet') {
        result = await uploadItem({
          type: 'magnet',
          data: target.data,
          name: target.name,
          seed: 3,
          allowZip: true,
          asQueued: false,
        });
      } else if (target.kind === 'usenet') {
        result = await uploadItem({
          type: 'usenet',
          data: target.data,
          name: target.name,
          asQueued: false,
        });
      } else {
        return;
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      setAddedItems((prev) => [...prev, item.key]);
      setToast({
        message: target.kind === 'magnet' ? t('toast.torrentAdded') : t('toast.nzbAdded'),
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: t('toast.addFailed', { error: err.message }),
        type: 'error',
      });
    } finally {
      setIsUploading((prev) => ({ ...prev, [item.key]: false }));
    }
  };

  const showNoResults =
    hasSearchCompleted &&
    Boolean(query) &&
    !loading &&
    !error &&
    !validationError &&
    results.length === 0;
  const showFilteredEmpty =
    hasSearchCompleted &&
    Boolean(query) &&
    !loading &&
    !error &&
    !validationError &&
    results.length > 0 &&
    displayResults.length === 0;
  const hasContent =
    loading ||
    error ||
    showNoResults ||
    showFilteredEmpty ||
    results.length > 0 ||
    addonStatuses.length > 0;

  if (!hasContent) return null;

  const typeFilterActive = streamTypes.length > 0;

  return (
    <section>
      {addonStatuses.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {addonStatuses.map((status) => {
            const typeKey = String(status.type || '').toLowerCase();
            const canToggle = Boolean(typeKey);
            const isActive = !typeFilterActive || streamTypes.includes(typeKey);
            const activeStyle = STATUS_ACTIVE[status.status] || STATUS_ACTIVE.pending;
            const className = `inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              isActive ? activeStyle : STATUS_INACTIVE
            } ${canToggle ? 'cursor-pointer hover:opacity-90 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40' : ''}`;

            const content = (
              <>
                <span className="font-semibold">{status.addonName}</span>
                <span className="opacity-50">·</span>
                <span className="opacity-80">{status.type}</span>
                <span className="opacity-50">·</span>
                <span>{statusLabel(status.status, t)}</span>
                {status.status === 'ok' ? (
                  <span className="ml-0.5 rounded bg-current/10 px-1 py-px text-[10px]">
                    {status.count}
                  </span>
                ) : null}
              </>
            );

            if (!canToggle) {
              return (
                <span key={status.key} className={className} title={status.error || undefined}>
                  {content}
                </span>
              );
            }

            return (
              <button
                key={status.key}
                type="button"
                className={className}
                title={status.error || t('typeFilterToggle', { type: status.type })}
                aria-pressed={typeFilterActive ? streamTypes.includes(typeKey) : false}
                onClick={() => toggleStreamType(typeKey)}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}

      {(results.length > 0 || (loading && results.length > 0)) && !showFilteredEmpty && (
        <>
          <SearchResultsToolbar
            resultCount={displayResults.length}
            showCachedOnly={showCachedOnly}
            onShowCachedOnlyChange={setShowCachedOnly}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirToggle={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            addonOptions={addonOptions}
            addonId={addonId}
            onAddonIdChange={setAddonId}
            density={density}
            onDensityChange={handleDensityChange}
          />

          <div className={`min-w-0 ${density === 'compact' ? 'space-y-1.5' : 'space-y-2'}`}>
            {displayResults.map((item) => (
              <SearchResultRow
                key={item.key}
                item={item}
                density={density}
                isUploading={Boolean(isUploading[item.key])}
                isAdded={addedItems.includes(item.key)}
                onCopyLink={copyLink}
                onUpload={handleUpload}
              />
            ))}
          </div>
        </>
      )}

      {showFilteredEmpty && (
        <>
          <SearchResultsToolbar
            resultCount={0}
            showCachedOnly={showCachedOnly}
            onShowCachedOnlyChange={setShowCachedOnly}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirToggle={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            addonOptions={addonOptions}
            addonId={addonId}
            onAddonIdChange={setAddonId}
            density={density}
            onDensityChange={handleDensityChange}
          />
          <div className="rounded-lg border border-border/60 bg-surface-alt/30 px-4 py-12 text-center dark:border-border-dark/60 dark:bg-surface-alt-dark/20">
            <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
              {t('filteredEmpty')}
            </h2>
            <p className="mt-2 text-sm text-primary-text/55 dark:text-primary-text-dark/55">
              {t('filteredEmptyHint')}
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showNoResults && (
        <div className="rounded-lg border border-border/60 bg-surface-alt/30 px-4 py-12 text-center dark:border-border-dark/60 dark:bg-surface-alt-dark/20">
          <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
            {t('noResults')}
          </h2>
          <p className="mt-2 text-sm text-primary-text/55 dark:text-primary-text-dark/55">
            {t('noResultsHint')}
          </p>
        </div>
      )}

      {loading && !results.length && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/60 bg-surface-alt/30 py-16 dark:border-border-dark/60 dark:bg-surface-alt-dark/20">
          <Spinner size="md" className="text-accent dark:text-accent-dark" />
          <p className="text-sm text-primary-text/50 dark:text-primary-text-dark/50">
            {t('addonStatus.pending')}
          </p>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  );
}
