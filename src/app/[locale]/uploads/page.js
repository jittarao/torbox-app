'use client';

import UploadManager from '@/components/uploads/UploadManager';
import AppShell from '@/components/navigation/AppShell';
import { Inter } from 'next/font/google';
import { useEffect } from 'react';
import { useSession } from '@/components/shared/hooks/useSession';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function UploadsPage() {
  const { apiKey, hydrated } = useSession();

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
