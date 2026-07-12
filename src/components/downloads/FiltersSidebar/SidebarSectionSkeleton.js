'use client';

function SidebarListItemSkeleton({ width = '70%' }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 animate-pulse" aria-hidden>
      <div className="size-3.5 shrink-0 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 rounded bg-zinc-200 dark:bg-zinc-700" style={{ width }} />
      <div className="ml-auto h-3 w-6 shrink-0 rounded bg-zinc-200/80 dark:bg-zinc-700/80" />
    </div>
  );
}

const ROW_WIDTHS = ['72%', '58%', '80%', '64%', '52%'];

export default function SidebarSectionSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-0.5 px-1" role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <SidebarListItemSkeleton key={index} width={ROW_WIDTHS[index % ROW_WIDTHS.length]} />
      ))}
    </div>
  );
}
