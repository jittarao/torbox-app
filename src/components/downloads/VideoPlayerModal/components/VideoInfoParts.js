'use client';

export function InfoSection({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={className}>
      <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-white/50">
        {Icon ? <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/5">
        {children}
      </div>
    </section>
  );
}

export function InfoRow({ label, value, mono = false }) {
  if (value == null || value === '') return null;

  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-xs text-white/50 sm:w-28">{label}</dt>
      <dd
        className={`min-w-0 flex-1 break-words text-sm text-white/90 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function InfoChip({ children, accent = false }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium',
        accent
          ? 'border-accent/30 bg-accent/15 text-accent dark:border-accent-dark/30 dark:bg-accent-dark/15 dark:text-accent-dark'
          : 'border-white/10 bg-white/5 text-white/80',
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export function TrackRow({ title, meta, badge }) {
  return (
    <div className="flex min-w-0 items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white">{title}</span>
          {badge ? (
            <span className="rounded-md border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent dark:border-accent-dark/30 dark:bg-accent-dark/15 dark:text-accent-dark">
              {badge}
            </span>
          ) : null}
        </div>
        {meta ? <p className="mt-1 text-xs text-white/55">{meta}</p> : null}
      </div>
    </div>
  );
}
