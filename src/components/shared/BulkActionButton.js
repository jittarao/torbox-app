'use client';

import Tooltip from '@/components/shared/Tooltip';
import Spinner from '@/components/shared/Spinner';

const VARIANT_CLASS = {
  primary:
    'bg-accent text-white border border-accent/30 hover:bg-accent/90 dark:bg-accent-dark/15 dark:text-accent-dark dark:border-accent-dark/30 dark:hover:bg-accent-dark/25',
  secondary:
    'border border-border bg-surface-alt text-primary-text hover:bg-surface-alt-hover dark:border-border-dark dark:bg-surface-alt-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-hover-dark',
  accent:
    'border border-accent/35 text-accent hover:bg-accent/10 dark:border-accent-dark/40 dark:text-accent-dark dark:hover:bg-accent-dark/10',
  danger:
    'bg-label-danger-text text-white border border-label-danger-text/30 hover:brightness-95 dark:bg-label-danger-bg-dark dark:text-label-danger-text-dark dark:border-label-danger-text-dark/20 dark:hover:bg-label-danger-bg-dark/80',
  ghost:
    'border border-transparent text-primary-text/70 hover:text-primary-text hover:bg-primary-text/5 dark:text-primary-text-dark/70 dark:hover:text-primary-text-dark dark:hover:bg-primary-text-dark/5',
  stop: 'border border-label-danger-text/25 text-label-danger-text hover:bg-label-danger-text/10 dark:border-label-danger-text-dark/30 dark:text-label-danger-text-dark dark:hover:bg-label-danger-text-dark/10',
};

/**
 * Compact toolbar action with icon + short label.
 */
export default function BulkActionButton({
  onClick,
  disabled = false,
  loading = false,
  variant = 'secondary',
  icon,
  label,
  title,
  className = '',
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={title || label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 ${VARIANT_CLASS[variant]} ${className}`}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  );

  if (title) {
    return <Tooltip content={title}>{button}</Tooltip>;
  }

  return button;
}
