'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { useTmdbCredentialsStore } from '@/store/tmdbCredentialsStore';
import Spinner from '@/components/shared/Spinner';
import { ChevronDown, ChevronUp, Key, Trash } from '@/components/icons';

const TMDB_API_DOCS = 'https://www.themoviedb.org/settings/api';

export default function TmdbKeyManager() {
  const t = useTranslations('TmdbKey');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [localError, setLocalError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { configured, loading, mutating, error, fetchStatus, saveKey, removeKey } =
    useTmdbCredentialsStore(
      useShallow((s) => ({
        configured: s.configured,
        loading: s.loading,
        mutating: s.mutating,
        error: s.error,
        fetchStatus: s.fetchStatus,
        saveKey: s.saveKey,
        removeKey: s.removeKey,
      }))
    );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!loading && !hasInitialized) {
      setExpanded(!configured);
      setHasInitialized(true);
    }
  }, [loading, configured, hasInitialized]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLocalError(null);
    const result = await saveKey(apiKeyInput);
    if (!result.success) {
      setLocalError(result.error || t('errors.saveFailed'));
      return;
    }
    setApiKeyInput('');
  };

  const handleRemove = async () => {
    if (!window.confirm(t('confirmRemove'))) return;
    setLocalError(null);
    const result = await removeKey();
    if (!result.success) setLocalError(result.error || t('errors.removeFailed'));
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
            <Key className="size-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-primary-text dark:text-primary-text-dark">
              {t('title')}
            </h2>
            <p className="text-xs text-primary-text/55 dark:text-primary-text-dark/55">
              {loading
                ? t('loading')
                : configured
                  ? t('statusConfigured')
                  : t('statusNotConfigured')}
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
            {t('help')}{' '}
            <a
              href={TMDB_API_DOCS}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline dark:text-accent-dark"
            >
              {t('docsLink')}
            </a>
            <span className="block mt-1">{t('keyTypeHint')}</span>
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={configured ? t('placeholderReplace') : t('placeholder')}
              className="min-w-0 flex-1 rounded-md border border-border/80 bg-surface px-3 py-2 text-sm text-primary-text placeholder:text-primary-text/35 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark dark:placeholder:text-primary-text-dark/35 dark:focus:border-accent-dark/50 dark:focus:ring-accent-dark/30"
              disabled={mutating}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={mutating || !apiKeyInput.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
            >
              {mutating ? <Spinner size="sm" className="text-white" /> : null}
              {configured ? t('update') : t('save')}
            </button>
            {configured ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={mutating}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border/80 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-border-dark/80 dark:text-red-400"
                aria-label={t('remove')}
              >
                <Trash className="size-3.5" />
                {t('remove')}
              </button>
            ) : null}
          </form>

          {(localError || error) && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {localError || error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
