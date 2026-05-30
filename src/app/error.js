'use client';

export default function RootError({ error, reset }) {
  return (
    <html>
      <body className="bg-background dark:bg-background-dark text-primary-text dark:text-primary-text-dark">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 max-w-md text-center">
            {error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
