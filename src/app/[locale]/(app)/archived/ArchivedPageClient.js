'use client';

import ArchivedDownloads from '@/components/ArchivedDownloads';
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
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <ArchivedDownloads apiKey={apiKey} />
    </div>
  );
}
