'use client';

import { useEffect } from 'react';
import SectionErrorFallback from '@/components/shared/SectionErrorFallback';
import { reportClientError } from '@/components/shared/clientErrorDisplay';

export default function LocaleError({ error, reset }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <SectionErrorFallback
      error={error}
      onRetry={reset}
      showReload
      className="min-h-[50vh] my-8"
    />
  );
}
