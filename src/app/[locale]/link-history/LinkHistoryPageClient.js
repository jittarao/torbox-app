'use client';

import AppShell from '@/components/navigation/AppShell';
import LinkHistory from '@/components/LinkHistory';
import Spinner from '@/components/shared/Spinner';
import { useSession } from '@/components/shared/hooks/useSession';

export default function LinkHistoryPageClient() {
  const { apiKey, hydrated } = useSession();

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
        <LinkHistory apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
