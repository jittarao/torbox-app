/**
 * Shared layout classes for downloads table/card views.
 * Tablet range (md, below lg): tighter padding and type for iPad-sized viewports.
 */

export const tableDataCellPad = 'px-4 py-4 md:px-2.5 md:py-2 lg:px-3.5 lg:py-2.5';

export const tableDataCellText = `${tableDataCellPad} whitespace-nowrap text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`;

export const tableCheckboxCell =
  'px-2 md:px-2.5 lg:px-4 py-4 md:py-2 lg:py-2.5 text-center whitespace-nowrap';

export const tableActionsCell =
  'px-2 md:px-2.5 lg:px-4 py-4 md:py-2 lg:py-2.5 md:pb-2 lg:pb-[12px] whitespace-nowrap text-right text-sm md:text-xs lg:text-sm font-medium sticky right-0 z-10 md:bg-inherit md:dark:bg-inherit';

export const tableHeaderCell =
  'px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-left text-xs md:text-[11px] lg:text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wide';

export const tableHeaderCheckboxCell =
  'px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-center text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase w-[48px] min-w-[48px] max-w-[48px] md:w-[52px] md:min-w-[52px] md:max-w-[52px] lg:w-[60px] lg:min-w-[60px] lg:max-w-[60px]';

export const tableHeaderActionsCell =
  'px-2 md:px-2.5 lg:px-4 py-3 md:py-2 lg:py-2.5 text-right text-xs md:text-[11px] lg:text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wide sticky right-0 bg-surface-alt dark:bg-surface-alt-dark w-[100px] min-w-[100px] max-w-[100px] md:w-[92px] md:min-w-[92px] md:max-w-[92px] lg:w-[100px] lg:min-w-[100px] lg:max-w-[100px]';

export const tableContainerClass =
  'overflow-x-auto rounded-lg md:rounded-xl border border-border dark:border-border-dark md:shadow-sm md:shadow-black/[0.03] dark:md:shadow-black/20';

export const cardContainerPad =
  'px-3 py-3 md:px-3.5 md:py-3 lg:p-4 rounded-lg md:rounded-xl border border-border/80 dark:border-border-dark/80 md:border-border/50 dark:md:border-border-dark/50 md:shadow-sm md:shadow-black/[0.04] dark:md:shadow-black/25';

export const cardListItemGap = 'mb-2 md:mb-1.5 lg:mb-2';
