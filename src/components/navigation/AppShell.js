'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import ReferralHeaderBanner from '@/components/referral/ReferralHeaderBanner';
import { useTheme } from '@/contexts/ThemeContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { buildNavItems } from './navConfig';
import useNavActive from './useNavActive';
import SidebarHeader from './SidebarHeader';
import SidebarNav from './SidebarNav';
import SidebarUtilitiesFooter from './SidebarUtilitiesFooter';
import { SidebarContext, useSidebar } from './SidebarContext';
import useSidebarCollapsed from './useSidebarCollapsed';

const SIDEBAR_EXPANDED = '16rem';
const SIDEBAR_COLLAPSED = '4.5rem';

function DesktopSidebar({ apiKey, nav, isActive, getLabel, t, toggleDarkMode }) {
  const { collapsed } = useSidebar();
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/60 bg-surface/85 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark/85 md:flex"
      style={{ width: sidebarWidth }}
      aria-label={t('title')}
    >
      <SidebarHeader isActive={isActive} getLabel={getLabel} />
      <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} />
        <SidebarUtilitiesFooter
          apiKey={apiKey}
          t={t}
          toggleDarkMode={toggleDarkMode}
          layout="desktop"
        />
    </aside>
  );
}

export default function AppShell({ apiKey, children, className = '' }) {
  const { searchPageDisabled } = useFeatureFlags();
  const t = useTranslations('Header');
  const { isActive, pathname } = useNavActive();
  const { toggleDarkMode } = useTheme();
  const { collapsed, toggleCollapsed, hydrated } = useSidebarCollapsed();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);

  const nav = useMemo(
    () => buildNavItems({ searchPageDisabled }),
    [searchPageDisabled]
  );

  const getLabel = useCallback((labelKey) => t(`menu.${labelKey}`), [t]);

  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((open) => !open);
  }, []);

  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  const drawerWasOpen = useRef(false);
  useEffect(() => {
    if (drawerWasOpen.current && !isDrawerOpen) {
      menuButtonRef.current?.focus();
    }
    drawerWasOpen.current = isDrawerOpen;
  }, [isDrawerOpen]);

  const shellClass = ['min-h-screen', className].filter(Boolean).join(' ');
  const sidebarWidth = hydrated && collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const sidebarContextValue = useMemo(
    () => ({ collapsed: hydrated && collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed, hydrated]
  );

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <div
        className={shellClass}
        style={{
          '--sidebar-width': sidebarWidth,
          '--sidebar-width-expanded': SIDEBAR_EXPANDED,
          '--sidebar-width-collapsed': SIDEBAR_COLLAPSED,
        }}
      >
        <DesktopSidebar
          apiKey={apiKey}
          nav={nav}
          isActive={isActive}
          getLabel={getLabel}
          t={t}
          toggleDarkMode={toggleDarkMode}
        />

        {/* Mobile top bar */}
        <header className="z-mobile-header sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-surface/90 px-3 py-2.5 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 md:hidden">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
            <Image
              src="/images/TBM-logo.png"
              alt={t('logo')}
              width={24}
              height={24}
              className="shrink-0"
            />
            <span className="truncate text-sm font-semibold text-primary-text dark:text-primary-text-dark">
              {t('title')}
            </span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleDrawer}
            aria-label={t('menu.toggle')}
            aria-expanded={isDrawerOpen}
            aria-controls="app-mobile-nav"
            className="ui-header-icon-btn"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden
            >
              {isDrawerOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </header>

        {/* Mobile drawer backdrop */}
        <div
          className={`z-mobile-drawer-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
            isDrawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={closeDrawer}
          aria-hidden={!isDrawerOpen}
        />

        {/* Mobile drawer */}
        <SidebarContext.Provider value={{ collapsed: false, toggleCollapsed: () => {} }}>
          <div
            id="app-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={t('menu.toggle')}
            aria-hidden={!isDrawerOpen}
            className={`z-mobile-drawer fixed inset-y-0 left-0 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-border/60 bg-surface/95 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark/95 md:hidden ${
              isDrawerOpen
                ? 'pointer-events-auto translate-x-0'
                : 'pointer-events-none -translate-x-full'
            }`}
          >
            <SidebarHeader
              isActive={isActive}
              getLabel={getLabel}
              onNavigate={closeDrawer}
              showCollapseToggle={false}
            />
            <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} onNavigate={closeDrawer} />
            <SidebarUtilitiesFooter
              apiKey={apiKey}
              t={t}
              toggleDarkMode={toggleDarkMode}
              layout="mobile"
            />
          </div>
        </SidebarContext.Provider>

        {/* Main content */}
        <div className="flex min-h-screen min-w-0 flex-col transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:pl-[var(--sidebar-width)]">
          <ReferralHeaderBanner apiKey={apiKey} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
