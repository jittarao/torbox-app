'use client';

import { ChevronDown, ChevronUp } from '@/components/icons';

/** Shared admin portal styling aligned with tailwind theme + globals ui-* classes */

export const adminCardClass =
  'rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark';

export const adminCardPadding = 'p-5 sm:p-6';

export const adminTableWrapClass = `${adminCardClass} overflow-hidden`;

export const adminTableClass = 'min-w-full divide-y divide-border/60 dark:divide-border-dark/60';

export const adminTheadClass = 'bg-surface-alt dark:bg-surface-dark';

export const adminThClass =
  'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-muted-dark sm:px-6';

export const adminTdClass = 'px-4 py-3 text-sm text-text dark:text-text-dark sm:px-6';

export const adminRowHoverClass =
  'transition-colors hover:bg-surface-alt-hover dark:hover:bg-surface-alt-dark-hover';

export const adminInputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-muted shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-muted-dark dark:focus:border-accent-dark dark:focus:ring-accent-dark/25';

const STATUS_STYLES = {
  healthy: 'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark',
  success: 'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark',
  active: 'bg-label-active-bg text-label-active-text dark:bg-label-active-bg-dark dark:text-label-active-text-dark',
  warning: 'bg-label-warning-bg text-label-warning-text dark:bg-label-warning-bg-dark dark:text-label-warning-text-dark',
  critical: 'bg-label-danger-bg text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark',
  danger: 'bg-label-danger-bg text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark',
  error: 'bg-label-danger-bg text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark',
  inactive: 'bg-label-default-bg text-label-default-text dark:bg-label-default-bg-dark dark:text-label-default-text-dark',
  default: 'bg-label-default-bg text-label-default-text dark:bg-label-default-bg-dark dark:text-label-default-text-dark',
};

export function adminStatusBadgeClass(status) {
  const key = String(status || 'default').toLowerCase();
  return STATUS_STYLES[key] || STATUS_STYLES.default;
}

export function AdminPageHeader({ title, description, actions, meta }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border/50 pb-5 dark:border-border-dark/50 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted dark:text-muted-dark">{description}</p>
        ) : null}
        {meta ? (
          <p className="text-xs text-muted dark:text-muted-dark">{meta}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminCard({ title, description, action, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`${adminCardClass} ${className}`}>
      {title ? (
        <div className="flex items-start justify-between gap-3 border-b border-border/50 px-5 py-4 dark:border-border-dark/50 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-primary-text dark:text-primary-text-dark">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted dark:text-muted-dark">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={`${adminCardPadding} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function AdminLoading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-border border-t-accent dark:border-border-dark dark:border-t-accent-dark"
        role="status"
        aria-label={label}
      />
      <p className="mt-3 text-sm text-muted dark:text-muted-dark">{label}</p>
    </div>
  );
}

export function AdminEmpty({ message = 'No data found' }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted dark:text-muted-dark">{message}</p>
    </div>
  );
}

export function AdminBadge({ status, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${adminStatusBadgeClass(status)} ${className}`}
    >
      {children ?? status}
    </span>
  );
}

export function AdminAlert({ variant = 'warning', children }) {
  const styles = {
    warning:
      'border-label-warning-text/20 bg-label-warning-bg text-label-warning-text dark:border-label-warning-text-dark/30 dark:bg-label-warning-bg-dark dark:text-label-warning-text-dark',
    danger:
      'border-label-danger-text/20 bg-label-danger-bg text-label-danger-text dark:border-label-danger-text-dark/30 dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark',
    info: 'border-label-active-text/20 bg-label-active-bg text-label-active-text dark:border-label-active-text-dark/30 dark:bg-label-active-bg-dark dark:text-label-active-text-dark',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[variant] || styles.warning}`}>
      {children}
    </div>
  );
}

export function AdminFilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
          : 'rounded-lg border border-border/60 bg-surface-alt px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-alt-hover hover:text-text dark:border-border-dark/60 dark:bg-surface-dark dark:text-muted-dark dark:hover:bg-surface-alt-dark-hover dark:hover:text-text-dark'
      }
    >
      {children}
    </button>
  );
}

export function AdminStatRow({ label, value, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted dark:text-muted-dark" title={hint}>
        {label}
      </span>
      <span className="font-medium text-text dark:text-text-dark">{value ?? '—'}</span>
    </div>
  );
}

export function AdminSortableTh({
  label,
  sortKey,
  activeSort,
  activeDirection,
  onSort,
  className = '',
  title,
  align = 'left',
}) {
  const isActive = activeSort === sortKey;
  const ariaSort = isActive ? (activeDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  const alignClass =
    align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : 'text-left';

  const sortHint = isActive
    ? activeDirection === 'asc'
      ? ' (ascending — click to reverse)'
      : ' (descending — click to reverse)'
    : ' (click to sort)';

  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={(title || label) + sortHint}
        className={`group -mx-1 flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-inherit transition-colors hover:bg-surface-hover hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-surface-hover-dark dark:hover:text-text-dark dark:focus-visible:ring-accent-dark/40 ${alignClass} ${isActive ? 'text-text dark:text-text-dark' : ''}`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`inline-flex shrink-0 flex-col leading-none ${isActive ? 'text-accent dark:text-accent-dark' : 'text-muted/50 group-hover:text-muted dark:text-muted-dark/50 dark:group-hover:text-muted-dark'}`}
          aria-hidden
        >
          {isActive ? (
            activeDirection === 'asc' ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )
          ) : (
            <>
              <ChevronUp className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
              <ChevronDown className="-mt-1 size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </>
          )}
        </span>
      </button>
    </th>
  );
}
