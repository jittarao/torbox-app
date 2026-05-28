'use client';

import UploadManager from '@/components/uploads/UploadManager';
import AppShell from '@/components/navigation/AppShell';
import { useSession } from '@/components/shared/hooks/useSession';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';

export default function UploadsPageClient() {
  const { apiKey, hydrated } = useSession();

  useEnsureUserDb(apiKey);

  if (!hydrated) {
    return null;
  }

  return (
    <AppShell apiKey={apiKey} className="min-h-screen bg-surface dark:bg-surface-dark font-sans">
      <div className="container mx-auto p-4">
        <UploadManager apiKey={apiKey} />
      </div>
    </AppShell>
  );
}
