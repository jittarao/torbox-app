'use client';

import ArchivedDownloads from '@/components/ArchivedDownloads';
import AppShell from '@/components/navigation/AppShell';
import Spinner from '@/components/shared/Spinner';
import { useEffect } from 'react';
import { useSession } from '@/components/shared/hooks/useSession';

export default function ArchivedPageClient() {
  const { apiKey, hydrated } = useSession();

  useEffect(() => {
    if (apiKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey).catch((error) => {
          console.error('Error ensuring user database on load:', error);
        });
      });
    }
  }, [apiKey]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface dark:bg-surface-dark">
        <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
      </div>
    );
  }

  return (
    <AppShell apiKey={apiKey} className="min-h-dvh bg-surface dark:bg-surface-dark font-sans">
      <div className="container mx-auto p-4">
        <ArchivedDownloads apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
