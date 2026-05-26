'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import FiltersSidebar from './index';

export default function MobileFiltersDrawer({ isOpen, onClose, sidebarProps }) {
  const t = useTranslations('DownloadsFilters');

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[min(85vw,var(--downloads-sidebar-width,16rem))] bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark shadow-xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t('sidebarLabel')}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-border-dark shrink-0">
          <span className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            {t('sidebarLabel')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
            aria-label={t('close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-2">
          <FiltersSidebar
            {...sidebarProps}
            className="w-full h-full border-0 rounded-none bg-transparent"
          />
        </div>
      </div>
    </>
  );
}
