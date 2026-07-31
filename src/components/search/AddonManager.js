'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import Spinner from '@/components/shared/Spinner';
import { ToggleSwitch } from '@/components/downloads/apiKeyManagerHelpers';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Refresh,
  Trash,
  UpArrow,
  DownArrow,
} from '@/components/icons';

function AddonCard({ addon, index, total, mutating, onToggle, onMove, onRefresh, onRemove, t }) {
  const [showPrefixes, setShowPrefixes] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const types = addon.types || [];
  const typeCount = types.length;
  const prefixCount = addon.id_prefixes?.length || 0;
  const visibleTypes = types.slice(0, 3);
  const hiddenTypes = types.slice(3);
  const allTypesLabel = types.join(' · ');

  return (
    <li
      className={`group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors sm:px-3.5 sm:py-2.5 ${
        addon.enabled
          ? 'border-border/80 bg-surface dark:border-border-dark/80 dark:bg-surface-dark'
          : 'border-border/50 bg-surface-alt/40 opacity-75 dark:border-border-dark/50 dark:bg-surface-alt-dark/30'
      }`}
    >
      {addon.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={addon.logo}
          alt=""
          referrerPolicy="no-referrer"
          className="size-9 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-xs font-semibold uppercase text-primary-text/40 dark:bg-surface-alt-dark dark:text-primary-text-dark/40">
          {(addon.name || '?').slice(0, 2)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-primary-text dark:text-primary-text-dark">
            {addon.name}
          </span>
          {addon.version ? (
            <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-primary-text/50 dark:bg-surface-alt-dark dark:text-primary-text-dark/50">
              v{addon.version}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-primary-text/50 dark:text-primary-text-dark/50">
          {typeCount > 0 && (
            <span className="inline-flex flex-wrap items-center gap-x-1">
              <span title={allTypesLabel}>{visibleTypes.join(' · ')}</span>
              {hiddenTypes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowTypes((v) => !v)}
                  className="text-accent hover:underline dark:text-accent-dark"
                  title={hiddenTypes.join(' · ')}
                  aria-expanded={showTypes}
                >
                  {showTypes ? t('hideTypes') : t('moreTypes', { count: hiddenTypes.length })}
                </button>
              ) : null}
            </span>
          )}
          {prefixCount > 0 && (
            <button
              type="button"
              onClick={() => setShowPrefixes((v) => !v)}
              className="text-accent hover:underline dark:text-accent-dark"
            >
              {showPrefixes ? t('hidePrefixes') : t('prefixCount', { count: prefixCount })}
            </button>
          )}
        </div>
        {showTypes && hiddenTypes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {types.map((type) => (
              <span
                key={type}
                className="rounded bg-surface-alt px-1.5 py-0.5 text-[10px] text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60"
              >
                {type}
              </span>
            ))}
          </div>
        )}
        {showPrefixes && prefixCount > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(addon.id_prefixes || []).map((prefix) => (
              <span
                key={prefix}
                className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60"
              >
                {prefix}:
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ToggleSwitch
          checked={Boolean(addon.enabled)}
          onChange={(v) => onToggle(addon.id, v)}
          ariaLabel={t('enabled')}
        />
        <div className="ml-1 flex items-center opacity-60 transition-opacity group-hover:opacity-100 sm:opacity-100">
          <button
            type="button"
            className="rounded-md p-1.5 text-primary-text/50 hover:bg-surface-alt hover:text-primary-text disabled:opacity-30 dark:text-primary-text-dark/50 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
            onClick={() => onMove(index, -1)}
            disabled={mutating || index === 0}
            aria-label={t('moveUp')}
          >
            <UpArrow className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-primary-text/50 hover:bg-surface-alt hover:text-primary-text disabled:opacity-30 dark:text-primary-text-dark/50 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
            onClick={() => onMove(index, 1)}
            disabled={mutating || index === total - 1}
            aria-label={t('moveDown')}
          >
            <DownArrow className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-primary-text/50 hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/50 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
            onClick={() => onRefresh(addon.id)}
            disabled={mutating}
            aria-label={t('refresh')}
          >
            <Refresh className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 dark:text-red-400/70 dark:hover:bg-red-400/10 dark:hover:text-red-400"
            onClick={() => onRemove(addon)}
            disabled={mutating}
            aria-label={t('remove')}
          >
            <Trash className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function AddonManager() {
  const t = useTranslations('StremioAddons');
  const [manifestUrl, setManifestUrl] = useState('');
  const [localError, setLocalError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const {
    addons,
    loading,
    error,
    mutating,
    fetchAddons,
    addAddon,
    setEnabled,
    refreshAddon,
    removeAddon,
    reorderAddons,
  } = useStremioAddonsStore(
    useShallow((s) => ({
      addons: s.addons,
      loading: s.loading,
      error: s.error,
      mutating: s.mutating,
      fetchAddons: s.fetchAddons,
      addAddon: s.addAddon,
      setEnabled: s.setEnabled,
      refreshAddon: s.refreshAddon,
      removeAddon: s.removeAddon,
      reorderAddons: s.reorderAddons,
    }))
  );

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  useEffect(() => {
    if (!loading && !hasInitialized) {
      setExpanded(addons.length === 0);
      setHasInitialized(true);
    }
  }, [loading, addons.length, hasInitialized]);

  const enabledCount = addons.filter((a) => a.enabled).length;

  const handleAdd = async (e) => {
    e.preventDefault();
    setLocalError(null);
    const result = await addAddon(manifestUrl.trim());
    if (!result.success) {
      setLocalError(result.error || t('errors.addFailed'));
      return;
    }
    setManifestUrl('');
  };

  const move = async (index, direction) => {
    const current = useStremioAddonsStore.getState().addons;
    const target = index + direction;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    const result = await reorderAddons(next.map((a) => a.id));
    if (!result.success) setLocalError(result.error);
  };

  const handleToggle = async (id, enabled) => {
    setLocalError(null);
    const result = await setEnabled(id, enabled);
    if (!result.success) setLocalError(result.error || t('errors.updateFailed'));
  };

  const handleRemove = async (addon) => {
    if (!window.confirm(t('confirmRemove', { name: addon.name }))) return;
    const result = await removeAddon(addon.id);
    if (!result.success) setLocalError(result.error);
  };

  const handleRefresh = async (id) => {
    const result = await refreshAddon(id);
    if (!result.success) setLocalError(result.error);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-surface-alt/30 dark:border-border-dark/70 dark:bg-surface-alt-dark/20">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-alt/50 dark:hover:bg-surface-alt-dark/30 sm:px-4"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark">
            <Plus className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-primary-text dark:text-primary-text-dark">
              {t('title')}
            </h2>
            <p className="text-xs text-primary-text/55 dark:text-primary-text-dark/55">
              {loading
                ? t('subtitle', { count: addons.length })
                : t('summary', { total: addons.length, enabled: enabledCount })}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-primary-text/40 dark:text-primary-text-dark/40">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 dark:border-border-dark/60 sm:px-4 sm:py-3.5">
          <p className="text-xs leading-relaxed text-primary-text/55 dark:text-primary-text-dark/55">
            {t('help')}
          </p>

          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
              placeholder={t('manifestUrlPlaceholder')}
              className="min-w-0 flex-1 rounded-md border border-border/80 bg-surface px-3 py-2 text-sm text-primary-text placeholder:text-primary-text/35 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark dark:placeholder:text-primary-text-dark/35 dark:focus:border-accent-dark/50 dark:focus:ring-accent-dark/30"
              disabled={mutating}
              required
            />
            <button
              type="submit"
              disabled={mutating || !manifestUrl.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
            >
              {mutating ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {t('add')}
            </button>
          </form>

          {(localError || error) && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {localError || error}
            </p>
          )}

          {loading && addons.length === 0 ? (
            <div className="flex justify-center py-6">
              <Spinner size="md" className="text-accent dark:text-accent-dark" />
            </div>
          ) : addons.length === 0 ? (
            <p className="py-2 text-center text-sm text-primary-text/55 dark:text-primary-text-dark/55">
              {t('empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {addons.map((addon, index) => (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  index={index}
                  total={addons.length}
                  mutating={mutating}
                  onToggle={handleToggle}
                  onMove={move}
                  onRefresh={handleRefresh}
                  onRemove={handleRemove}
                  t={t}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
