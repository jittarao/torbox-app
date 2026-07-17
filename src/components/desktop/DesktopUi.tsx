'use client';

import type { ReactNode } from 'react';

export const desktopCardClass =
  'rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark';

export const desktopCardPadding = 'p-5 sm:p-6';

export const desktopInputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text placeholder:text-muted shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:placeholder:text-muted-dark dark:focus:border-accent-dark dark:focus:ring-accent-dark/25';

export const desktopBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-accent-dark dark:hover:bg-accent-dark/90 dark:focus:ring-accent-dark/40';

export const desktopBtnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-text shadow-sm transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-surface-alt-hover-dark dark:focus:ring-accent-dark/20';

export const desktopOptionBase =
  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors';

export const desktopOptionSelected =
  'border-accent/40 bg-surface-alt-selected text-text shadow-sm dark:border-accent-dark/45 dark:bg-surface-alt-selected-dark dark:text-text-dark';

export const desktopOptionDefault =
  'border-border/50 bg-white text-text hover:border-border hover:bg-surface-alt dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark dark:hover:border-border-dark dark:hover:bg-surface-alt-hover-dark';

export const desktopTabSelected =
  'border-accent/35 bg-surface-alt-selected text-text shadow-sm dark:border-accent-dark/40 dark:bg-surface-alt-selected-dark dark:text-text-dark';

export const desktopTabDefault =
  'border-border/60 bg-white text-text hover:border-border hover:bg-surface-alt dark:border-border-dark/60 dark:bg-surface-alt-dark dark:text-text-dark dark:hover:border-border-dark dark:hover:bg-surface-alt-hover-dark';

export const desktopBtnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-label-danger-text/25 bg-white px-4 py-2 text-sm font-medium text-label-danger-text shadow-sm transition-colors hover:bg-label-danger-bg focus:outline-none focus:ring-2 focus:ring-label-danger-text/20 disabled:pointer-events-none disabled:opacity-50 dark:border-label-danger-text-dark/30 dark:bg-surface-dark dark:text-label-danger-text-dark dark:hover:bg-label-danger-bg-dark dark:focus:ring-label-danger-text-dark/20';

type DesktopStatus = 'success' | 'warning' | 'danger' | 'neutral' | 'active';

const STATUS_CLASSES: Record<DesktopStatus, string> = {
  success:
    'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark',
  warning:
    'bg-label-warning-bg text-label-warning-text dark:bg-label-warning-bg-dark dark:text-label-warning-text-dark',
  danger:
    'bg-label-danger-bg text-label-danger-text dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark',
  active:
    'bg-label-active-bg text-label-active-text dark:bg-label-active-bg-dark dark:text-label-active-text-dark',
  neutral:
    'bg-label-default-bg text-label-default-text dark:bg-label-default-bg-dark dark:text-label-default-text-dark',
};

export function DesktopStatusBadge({
  status = 'neutral',
  children,
  className = '',
  pulse = false,
}: {
  status?: DesktopStatus;
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]} ${className}`}
    >
      {pulse ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-40" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      ) : null}
      {children}
    </span>
  );
}

type DesktopToggleProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  description?: string;
  busy?: boolean;
};

export function DesktopToggle({
  id,
  checked,
  disabled = false,
  onChange,
  label,
  description,
  busy = false,
}: DesktopToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-text dark:text-text-dark">
          {label}
        </label>
        {description ? (
          <p
            id={`${id}-description`}
            className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark"
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {busy ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-border border-t-accent dark:border-border-dark dark:border-t-accent-dark"
            aria-hidden
          />
        ) : null}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={description ? `${id}-description` : undefined}
          disabled={disabled || busy}
          onClick={() => {
            onChange({
              target: { checked: !checked },
            } as React.ChangeEvent<HTMLInputElement>);
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 dark:focus:ring-accent-dark/30 ${
            checked
              ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
              : 'border-border bg-surface-alt dark:border-border-dark dark:bg-surface-dark'
          }`}
        >
          <span
            aria-hidden
            className={`pointer-events-none inline-block size-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function DesktopSubsection({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/50 bg-surface-alt/40 p-4 dark:border-border-dark/50 dark:bg-surface-dark/40 sm:p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-medium text-text dark:text-text-dark">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function DesktopActionBar({
  children,
  className = '',
  hint,
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div
      className={`space-y-2 rounded-lg border border-border/50 bg-surface-alt/60 p-3 dark:border-border-dark/50 dark:bg-surface-dark/60 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
      {hint ? (
        <p className="text-xs leading-relaxed text-muted dark:text-muted-dark">{hint}</p>
      ) : null}
    </div>
  );
}

export function DesktopInfoCallout({
  variant = 'info',
  children,
  className = '',
}: {
  variant?: 'info' | 'warning' | 'success' | 'neutral';
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-label-active-text/20 bg-label-active-bg/70 text-label-active-text dark:border-accent-dark/25 dark:bg-accent-dark/10 dark:text-text-dark',
    neutral:
      'border-border/60 bg-surface-alt/70 text-muted dark:border-border-dark/60 dark:bg-surface-dark/70 dark:text-muted-dark',
    warning:
      'border-label-warning-text/20 bg-label-warning-bg/70 text-label-warning-text dark:border-label-warning-text-dark/25 dark:bg-label-warning-bg-dark/50 dark:text-label-warning-text-dark',
    success:
      'border-label-success-text/20 bg-label-success-bg/70 text-label-success-text dark:border-label-success-text-dark/25 dark:bg-label-success-bg-dark/50 dark:text-label-success-text-dark',
  };

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

export function DesktopPathDisplay({
  value,
  emptyLabel,
}: {
  value?: string | null;
  emptyLabel: string;
}) {
  return (
    <p className="rounded-md border border-border/50 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-text break-all dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
      {value ?? emptyLabel}
    </p>
  );
}
