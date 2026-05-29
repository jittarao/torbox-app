/**
 * Shared layout classes for downloads table/card views.
 * Tablet range (md, below lg): tighter padding and type for iPad-sized viewports.
 */

/**
 * Inset row divider on table cells (not <tr> — Safari/WebKit does not paint box-shadow on rows).
 * Reliable with virtualization (unlike collapsed cell borders).
 */
export const tableRowSeparator =
  '[box-shadow:inset_0_-1px_0_0_#cecece] dark:[box-shadow:inset_0_-1px_0_0_#3c3c3c]';

/** Rows with tabIndex — suppress focus outline (shift+range select counts as focus-visible in some UAs) */
export const tableRowFocusClasses = 'outline-none focus:outline-none focus-visible:outline-none';

/**
 * Sticky actions cell shadows (one rule — arbitrary box-shadows override each other).
 * Bottom: row divider (<tr> inset does not paint on sticky cells).
 * Left: soft inset vignette inside the cell — depth when scrolling, no hard rule on neighbours.
 */
export const tableActionsCellShadows =
  '[box-shadow:inset_0_-1px_0_0_#cecece,inset_12px_0_10px_-12px_rgba(15,23,42,0.05)] dark:[box-shadow:inset_0_-1px_0_0_#3c3c3c,inset_12px_0_10px_-12px_rgba(0,0,0,0.2)]';

export const tableDataCellPad = `px-4 py-4 md:px-2.5 md:py-2 lg:px-3.5 lg:py-2.5 ${tableRowSeparator}`;

export const tableDataCellText = `${tableDataCellPad} whitespace-nowrap text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`;

/** ~6 icon buttons (stop seeding, files, download, delete, menu) — export lives in More dropdown */
const actionsColumnWidthClass =
  'w-[132px] min-w-[132px] max-w-[132px] md:w-[188px] md:min-w-[188px] md:max-w-[188px] lg:w-[200px] lg:min-w-[200px] lg:max-w-[200px]';

/** Shared sticky shell for the right-pinned actions column */
const tableActionsStickyShell = `sticky right-0 ${actionsColumnWidthClass} ${tableActionsCellShadows}`;

export const tableCheckboxCell = `px-2 md:px-2.5 lg:px-4 py-4 md:py-2 lg:py-2.5 text-center whitespace-nowrap ${tableRowSeparator}`;

export const tableActionsCell = `px-2 md:px-2.5 lg:px-3 py-2 md:py-1.5 lg:py-2 whitespace-nowrap text-right text-sm md:text-xs lg:text-sm font-medium z-[1] overflow-hidden ${tableActionsStickyShell}`;

/** Inner wrapper — clips icon hover rings inside the sticky column */
export const tableActionsCellInner =
  'flex w-full min-w-0 flex-nowrap items-center justify-end gap-1.5 md:gap-1';

/** Match actionsColumnWidthClass — used for file-row layout math */
export function getActionsColumnWidthPx() {
  if (typeof window === 'undefined') return 200;
  const w = window.innerWidth;
  if (w < 768) return 132;
  if (w < 1024) return 188;
  return 200;
}

/**
 * Row + sticky actions backgrounds. Sticky cells need their own bg; use group/group-hover
 * so hovering anywhere on the row updates the actions column (tr:hover alone is not enough).
 */
export function getTableRowSurfaceClasses({
  selected = false,
  downloaded = false,
  linkFailed = false,
} = {}) {
  if (selected) {
    const base = 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark';
    const hover =
      'hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark';
    return {
      row: `group ${base} ${hover}`,
      stickyCell: `${base} group-hover:bg-surface-alt-selected-hover dark:group-hover:bg-surface-alt-selected-hover-dark`,
    };
  }
  if (linkFailed) {
    const base = 'bg-link-failed dark:bg-link-failed-dark';
    const hover = 'hover:bg-link-failed-hover dark:hover:bg-link-failed-hover-dark';
    return {
      row: `group ${base} ${hover}`,
      stickyCell: `${base} group-hover:bg-link-failed-hover dark:group-hover:bg-link-failed-hover-dark`,
    };
  }
  if (downloaded) {
    const base = 'bg-downloaded dark:bg-downloaded-dark';
    const hover = 'hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark';
    return {
      row: `group ${base} ${hover}`,
      stickyCell: `${base} group-hover:bg-downloaded-hover dark:group-hover:bg-downloaded-hover-dark`,
    };
  }
  const base = 'bg-surface dark:bg-surface-dark';
  const hover = 'hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark';
  return {
    row: `group ${base} ${hover}`,
    stickyCell: `${base} group-hover:bg-surface-alt-hover dark:group-hover:bg-surface-alt-hover-dark`,
  };
}

export function getCheckboxColumnWidthPx() {
  if (typeof window === 'undefined') return 60;
  const w = window.innerWidth;
  if (w < 768) return 48;
  if (w < 1024) return 52;
  return 60;
}

export const tableHeaderCell = `px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-left text-xs md:text-[11px] lg:text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wide ${tableRowSeparator}`;

export const tableHeaderCheckboxCell = `px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-center text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase w-[48px] min-w-[48px] max-w-[48px] md:w-[52px] md:min-w-[52px] md:max-w-[52px] lg:w-[60px] lg:min-w-[60px] lg:max-w-[60px] ${tableRowSeparator}`;

export const tableHeaderActionsCell = `px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-right text-xs md:text-[11px] lg:text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wide z-[2] bg-surface-alt dark:bg-surface-alt-dark ${tableActionsStickyShell}`;

export const tableContainerClass =
  'overflow-x-auto rounded-lg md:rounded-xl border border-border dark:border-border-dark md:shadow-sm md:shadow-black/[0.03] dark:md:shadow-black/20';

export const cardContainerPad =
  'px-3 py-3 md:px-3.5 md:py-3 lg:p-4 rounded-lg md:rounded-xl border border-border/80 dark:border-border-dark/80 md:border-border/50 dark:md:border-border-dark/50 md:shadow-sm md:shadow-black/[0.04] dark:md:shadow-black/25';

export const cardListItemGap = 'mb-2 md:mb-1.5 lg:mb-2';

/** px gap after each card — keep in sync with cardListItemGap Tailwind classes */
export function getCardListItemGapPx() {
  if (typeof window === 'undefined') return 8;
  const w = window.innerWidth;
  if (w >= 768 && w < 1024) return 6;
  return 8;
}
