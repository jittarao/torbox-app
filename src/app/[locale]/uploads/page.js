'use client';

import UploadManager from '@/components/uploads/UploadManager';
import AppShell from '@/components/navigation/AppShell';
import { Inter } from 'next/font/google';
import { useSession } from '@/components/shared/hooks/useSession';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function UploadsPage() {
  const { apiKey, hydrated } = useSession();

  useEnsureUserDb(apiKey);

  if (!hydrated) {
    return null;
  }

  return (
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <div className="container mx-auto p-4">
        <UploadManager apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
