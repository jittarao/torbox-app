'use client';

import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import { X } from '@/components/icons';
import FiltersSidebar from './index';

export default function MobileFiltersDrawer({ isOpen, onClose, sidebarProps }) {
  const t = useTranslations('DownloadsFilters');

  return (
    <ModalSheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t('close')}
      dock
      overlayClassName="md:hidden"
      className="flex flex-col md:hidden"
      aria-labelledby="mobile-filters-title"
    >
      <div className="flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
        <ModalSheetHandle />

        <div className="relative shrink-0 border-b border-border/50 px-4 pb-2.5 dark:border-border-dark/50">
          <div className="flex items-center gap-2">
            <h2
              id="mobile-filters-title"
              className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark"
            >
              {t('sidebarLabel')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
              aria-label={t('close')}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2">
          <FiltersSidebar {...sidebarProps} variant="sheet" className="min-h-0 flex-1" />
        </div>
      </div>
    </ModalSheet>
  );
}
