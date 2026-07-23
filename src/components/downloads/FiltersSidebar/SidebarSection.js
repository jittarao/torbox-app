'use client';

function SectionChevron({ expanded, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.25}
      stroke="currentColor"
      className={`size-3 shrink-0 transition-transform duration-200 ease-out ${
        expanded ? '' : '-rotate-90'
      } ${className}`}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function SidebarSection({
  title,
  children,
  onAdd,
  addLabel,
  headerActions = null,
  tall,
  expanded,
  onToggle,
  toggleLabel,
  activeCount = 0,
}) {
  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-0.5 ${tall ? 'px-0 py-1.5' : 'p-1'}`}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={toggleLabel}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-alt/70 dark:hover:bg-surface-alt-dark/50"
        >
          <SectionChevron
            expanded={expanded}
            className="text-primary-text/35 group-hover:text-primary-text/55 dark:text-primary-text-dark/35 dark:group-hover:text-primary-text-dark/55"
          />
          <h3 className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-primary-text/50 group-hover:text-primary-text/70 dark:text-primary-text-dark/50 dark:group-hover:text-primary-text-dark/70">
            {title}
          </h3>
          {!expanded && activeCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-px text-[10px] font-semibold tabular-nums text-accent dark:bg-accent-dark/20 dark:text-accent-dark">
              {activeCount}
            </span>
          )}
        </button>
        {headerActions}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 rounded text-primary-text/50 hover:text-accent dark:text-primary-text-dark/50 dark:hover:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
            aria-label={addLabel}
            title={addLabel}
          >
            <svg
              className="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className={`pb-2 ${tall ? 'space-y-1 px-0' : 'space-y-0.5 px-1'}`}>{children}</div>
      )}
    </div>
  );
}
