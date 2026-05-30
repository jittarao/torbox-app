/**
 * Server-rendered route loading shell (App Router loading.js).
 * Matches AppShell layout: sidebar rail + main content skeleton.
 */
export default function PageRouteLoading() {
  return (
    <div
      className="min-h-screen bg-surface dark:bg-surface-dark font-sans"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[16rem] flex-col border-r border-border/60 bg-surface/85 dark:border-border-dark/60 dark:bg-surface-dark/85">
        <div className="h-14 border-b border-border/40 dark:border-border-dark/40 px-4 flex items-center">
          <div className="h-6 w-32 rounded bg-border/50 dark:bg-border-dark/50 animate-pulse" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 rounded-lg bg-border/40 dark:bg-border-dark/40 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="md:pl-[16rem] min-h-screen">
        <div className="md:hidden h-14 border-b border-border/60 dark:border-border-dark/60 flex items-center px-4 gap-3">
          <div className="size-8 rounded bg-border/50 dark:bg-border-dark/50 animate-pulse" />
          <div className="h-5 flex-1 max-w-[10rem] rounded bg-border/50 dark:bg-border-dark/50 animate-pulse" />
        </div>

        <div className="p-4 md:p-6 space-y-4 max-w-[96rem] mx-auto">
          <div className="h-10 w-full max-w-xl rounded-lg bg-border/40 dark:bg-border-dark/40 animate-pulse" />
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 rounded-lg bg-border/30 dark:bg-border-dark/30 animate-pulse"
              />
            ))}
          </div>
          <div className="rounded-xl border border-border/60 dark:border-border-dark/60 overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-12 border-b border-border/40 dark:border-border-dark/40 last:border-0 bg-border/20 dark:bg-border-dark/20 animate-pulse"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
