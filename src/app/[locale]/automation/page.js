'use client';

import AutomationRules from '@/components/downloads/AutomationRules';
import AppShell from '@/components/navigation/AppShell';
import { Inter } from 'next/font/google';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function AutomationPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('torboxApiKey') || '');

  useEffect(() => {
    if (apiKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey)
          .then((result) => {
            if (result.success && result.wasCreated) {
              console.log('User database created for existing API key');
            }
          })
          .catch((error) => {
            console.error('Error ensuring user database on load:', error);
          });
      });
    }
  }, [apiKey]);

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
