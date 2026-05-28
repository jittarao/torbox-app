'use client';

import { useEffect } from 'react';

export default function LocaleError({ error, reset }) {
  useEffect(() => {
    console.error('Locale segment error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center">
      <h2 className="text-lg font-semibold text-primary dark:text-primary-dark">Something went wrong</h2>
      <p className="text-sm text-secondary dark:text-secondary-dark max-w-md">
        {error?.message || 'An unexpected error occurred.'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
