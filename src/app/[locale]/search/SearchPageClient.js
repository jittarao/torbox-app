'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import AppShell from '@/components/navigation/AppShell';
import AddonManager from '@/components/search/AddonManager';
import TmdbKeyManager from '@/components/search/TmdbKeyManager';
import SearchBar from '@/components/search/SearchBar';
import SearchResults from '@/components/search/SearchResults';
import { useSession } from '@/components/shared/hooks/useSession';
import { useBackendMode } from '@/hooks/useBackendMode';

export default function SearchPageClient() {
  const t = useTranslations('SearchPage');
  const { apiKey, hydrated } = useSession();
  const { mode, isLoading: isChecking } = useBackendMode();
  const isBackendAvailable = mode === 'backend';

  if (!hydrated) {
    return <div className="min-h-dvh bg-surface dark:bg-surface-dark font-sans" aria-hidden />;
  }

  return (
    <AppShell
      apiKey={apiKey}
      className="min-h-dvh bg-surface dark:bg-surface-dark font-sans text-primary-text dark:text-primary-text-dark"
    >
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-5">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-2xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-primary-text/60 dark:text-primary-text-dark/60">
            {t('subtitle')}
          </p>
        </header>

        {!isChecking && !isBackendAvailable ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            {t('backendRequired')}
          </div>
        ) : (
          <Suspense fallback={null}>
            <div className="space-y-4">
              <TmdbKeyManager />
              <AddonManager />
              <SearchBar />
              <SearchResults apiKey={apiKey} />
            </div>
          </Suspense>
        )}
      </div>
    </AppShell>
  );
}
