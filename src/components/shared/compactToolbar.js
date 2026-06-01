/** Shared compact toolbar layout + control styles (uploads, link history, RSS, etc.). */

export const compactToolbarClass =
  'flex min-w-0 flex-wrap items-center justify-end gap-1.5';

export const compactControlClass =
  'px-2.5 py-1.5 text-sm bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-md text-primary-text dark:text-primary-text-dark';

export const compactSearchInputClass = `${compactControlClass} placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50 w-36 sm:w-44`;
