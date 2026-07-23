'use client';

import AutomationRules from '@/components/downloads/AutomationRules';
import AppShell from '@/components/navigation/AppShell';
import { useEffect } from 'react';
import { useSession } from '@/components/shared/hooks/useSession';

export default function AutomationPageClient() {
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
    return null;
  }

  return (
    <AppShell apiKey={apiKey} className="min-h-dvh bg-surface dark:bg-surface-dark font-sans">
      <div className="container mx-auto p-4">
        <AutomationRules apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
