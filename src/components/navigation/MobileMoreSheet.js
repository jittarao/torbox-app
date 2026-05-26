'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import { USER_NAV_ITEM } from './navConfig';
import SidebarUtilitiesFooter from './SidebarUtilitiesFooter';
import { SidebarContext } from './SidebarContext';

function MoreNavLink({ href, label, Icon, active, onNavigate }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={active ? 'ui-mobile-more-link-active' : 'ui-mobile-more-link'}
      >
        <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    </li>
  );
}

export default function MobileMoreSheet({
  open,
  onClose,
  moreItems,
  isActive,
  getLabel,
  apiKey,
  t,
  toggleDarkMode,
}) {
  const tFilters = useTranslations('DownloadsFilters');
  const sheetRef = useRef(null);
  const userLabel = getLabel(USER_NAV_ITEM.labelKey);
  const userActive = isActive(USER_NAV_ITEM.href);
  const UserIcon = USER_NAV_ITEM.Icon;

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <HeaderOverlayPortal open={open}>
      <div
        className={`z-overlay-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.more')}
        aria-hidden={!open}
        className={`z-overlay-panel fixed inset-x-0 bottom-0 flex max-h-[min(85dvh,32rem)] flex-col rounded-t-2xl border border-border/60 bg-surface shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark md:hidden ${
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <div
            className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600"
            aria-hidden
          />
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2 dark:border-border-dark/40">
          <h2 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            {t('menu.more')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-header-icon-btn"
            aria-label={tFilters('close')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          <ul className="space-y-0.5">
            {moreItems.map((item) => (
              <MoreNavLink
                key={item.href}
                href={item.href}
                label={getLabel(item.labelKey)}
                Icon={item.Icon}
                active={isActive(item.href)}
                onNavigate={onClose}
              />
            ))}
            <MoreNavLink
              href={USER_NAV_ITEM.href}
              label={userLabel}
              Icon={UserIcon}
              active={userActive}
              onNavigate={onClose}
            />
          </ul>
        </div>

        <div className="shrink-0 border-t border-border/60 dark:border-border-dark/60">
          <SidebarContext.Provider value={{ collapsed: false, toggleCollapsed: () => {} }}>
            <SidebarUtilitiesFooter
              apiKey={apiKey}
              t={t}
              toggleDarkMode={toggleDarkMode}
              layout="mobile"
            />
          </SidebarContext.Provider>
        </div>
      </div>
    </HeaderOverlayPortal>
  );
}
