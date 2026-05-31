'use client';

import { useEffect } from 'react';
import SectionErrorFallbackView from '@/components/shared/SectionErrorFallbackView';
import { reportClientError } from '@/components/shared/clientErrorDisplay';

const LABELS = {
  title: 'Something went wrong',
  messageFallback:
    'The app hit an unexpected error. Try again or reload the page. Navigation may be unavailable on this screen.',
  tryAgainLabel: 'Try again',
  reloadLabel: 'Reload page',
};

export default function RootError({ error, reset }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-surface text-primary-text dark:bg-surface-dark dark:text-primary-text-dark antialiased">
        <div className="flex min-h-screen items-center justify-center p-8">
          <SectionErrorFallbackView
            error={error}
            onRetry={reset}
            showReload
            className="w-full max-w-lg border-0 bg-transparent"
            {...LABELS}
          />
        </div>
      </body>
    </html>
  );
}
