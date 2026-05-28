'use client';

import AutomationRules from '@/components/downloads/AutomationRules';
import AppShell from '@/components/navigation/AppShell';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { useSession } from '@/components/shared/hooks/useSession';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function AutomationPage() {
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
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <div className="container mx-auto p-4">
        <AutomationRules apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
