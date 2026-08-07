'use client';

import LinkHistory from '@/components/LinkHistory';
import Spinner from '@/components/shared/Spinner';
import { useSession } from '@/components/shared/hooks/useSession';

export default function LinkHistoryPageClient() {
  const { apiKey, hydrated } = useSession();

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <LinkHistory apiKey={apiKey} />
    </div>
  );
}
