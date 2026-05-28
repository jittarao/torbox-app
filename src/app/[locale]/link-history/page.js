'use client';

import AppShell from '@/components/navigation/AppShell';
import LinkHistory from '@/components/LinkHistory';
import { Inter } from 'next/font/google';
import { useSession } from '@/components/shared/hooks/useSession';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function LinkHistoryPage() {
  const { apiKey, hydrated } = useSession();

  if (!hydrated) {
    return null;
  }

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
