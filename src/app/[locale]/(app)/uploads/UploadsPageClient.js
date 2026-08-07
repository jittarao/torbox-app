'use client';

import UploadManager from '@/components/uploads/UploadManager';
import Spinner from '@/components/shared/Spinner';
import { useSession } from '@/components/shared/hooks/useSession';
import { useEnsureUserDb } from '@/components/shared/hooks/useEnsureUserDb';

export default function UploadsPageClient() {
  const { apiKey, hydrated } = useSession();

  useEnsureUserDb(apiKey);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <UploadManager apiKey={apiKey} />
    </div>
  );
}
