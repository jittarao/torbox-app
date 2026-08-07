'use client';

import AutomationRules from '@/components/downloads/AutomationRules';
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
    <div className="container mx-auto p-4">
      <AutomationRules apiKey={apiKey} />
    </div>
  );
}
