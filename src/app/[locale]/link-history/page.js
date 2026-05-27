'use client';

import { useState } from 'react';
import AppShell from '@/components/navigation/AppShell';
import LinkHistory from '@/components/LinkHistory';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function LinkHistoryPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('torboxApiKey') || '');

  return (
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <div className="container mx-auto p-4">
        <LinkHistory apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
