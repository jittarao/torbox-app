'use client';

import AppShell from '@/components/navigation/AppShell';
import LinkHistory from '@/components/LinkHistory';
import { useSession } from '@/components/shared/hooks/useSession';

export default function LinkHistoryPageClient() {
  const { apiKey, hydrated } = useSession();

  if (!hydrated) {
    return null;
  }

  return (
    <AppShell apiKey={apiKey} className="min-h-screen bg-surface dark:bg-surface-dark font-sans">
      <div className="container mx-auto p-4">
        <LinkHistory apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
