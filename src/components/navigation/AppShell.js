'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Icons from '@/components/icons';
import NotificationBell from '@/components/notifications/NotificationBell';
import SystemStatusIndicator from '@/components/shared/SystemStatusIndicator';
import ReferralDropdown from '@/components/ReferralDropdown';
import ReferralHeaderBanner from '@/components/referral/ReferralHeaderBanner';
import { GITHUB_REPO_URL } from '@/components/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { getVersion } from '@/utils/version';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { buildNavItems } from './navConfig';
import useNavActive from './useNavActive';
import SidebarNavSection from './SidebarNavSection';
import { SidebarContext, useSidebar } from './SidebarContext';
import useSidebarCollapsed from './useSidebarCollapsed';

const SIDEBAR_EXPANDED = '16rem';
const SIDEBAR_COLLAPSED = '4.5rem';

function SidebarBrand() {
  const t = useTranslations('Header');
  const { collapsed } = useSidebar();

  return (
    <Link
      href="/"
      title={collapsed ? t('title') : undefined}
      className={`flex min-w-0 items-center rounded-lg py-1.5 transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] ${
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2'
      }`}
    >
      <Image
        src="/images/TBM-logo.png"
        alt={t('logo')}
        width={28}
        height={28}
        className="shrink-0"
      />
      <div
        className={`flex min-w-0 flex-col overflow-hidden transition-[opacity,width,margin] duration-300 ease-out ${
          collapsed ? 'pointer-events-none m-0 w-0 opacity-0' : 'opacity-100'
        }`}
      >
        <span className="truncate text-sm font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </span>
        <span className="truncate text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
          v{getVersion()}
        </span>
      </div>
    </Link>
  );
}

function SidebarCollapseToggle() {
  const t = useTranslations('Header');
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? t('menu.expandSidebar') : t('menu.collapseSidebar')}
      className="ui-header-icon-btn shrink-0 transition-transform duration-300 ease-out hover:scale-105 active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className={`h-5 w-5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          collapsed ? 'rotate-180' : ''
        }`}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}

function SettingsRow({ t, toggleDarkMode, languageCompact = true }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={`flex items-center gap-1 transition-all duration-300 ${
        collapsed ? 'flex-col' : 'flex-row'
      }`}
    >
      <button
        onClick={toggleDarkMode}
        aria-label={t('theme.toggle')}
        className="ui-theme-toggle shrink-0"
        type="button"
      >
        <span className="ui-theme-toggle-knob">
          <Icons.Sun className="block h-4 w-4 dark:hidden" />
          <Icons.Moon className="hidden h-4 w-4 dark:block" />
        </span>
      </button>
      <LanguageSwitcher compact={languageCompact || collapsed} />
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub Repository"
        className="ui-header-icon-btn"
        title="GitHub"
      >
        <Icons.GitHub className="h-5 w-5" />
      </a>
    </div>
  );
}

function UtilityFlyout({ children }) {
  return <div className="ui-sidebar-flyout-anchor relative z-[260] shrink-0">{children}</div>;
}

function SidebarUtilities({ apiKey, t, toggleDarkMode, layout = 'row' }) {
  const { collapsed } = useSidebar();

  if (layout === 'mobile') {
    return (
      <div className="space-y-3 border-t border-border/60 px-4 py-4 dark:border-border-dark/60">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('menu.referrals')}
          </span>
          <UtilityFlyout>
            <ReferralDropdown apiKey={apiKey} />
          </UtilityFlyout>
        </div>
        {apiKey ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t('menu.notifications')}
            </span>
            <UtilityFlyout>
              <NotificationBell apiKey={apiKey} />
            </UtilityFlyout>
          </div>
        ) : null}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('menu.systemStatus')}
          </span>
          <UtilityFlyout>
            <SystemStatusIndicator apiKey={apiKey} />
          </UtilityFlyout>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('theme.toggle')}
          </span>
          <button
            onClick={toggleDarkMode}
            aria-label={t('theme.toggle')}
            className="ui-theme-toggle"
            type="button"
          >
            <span className="ui-theme-toggle-knob">
              <Icons.Sun className="block h-4 w-4 dark:hidden" />
              <Icons.Moon className="hidden h-4 w-4 dark:block" />
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('menu.language') || 'Language'}
          </span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">GitHub</span>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            className="ui-header-icon-btn"
          >
            <Icons.GitHub className="h-5 w-5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border/60 px-2 py-3 dark:border-border-dark/60">
      <div
        className={`mb-2 flex gap-1 transition-all duration-300 ${
          collapsed ? 'flex-col items-center' : 'flex-row flex-wrap items-center'
        }`}
      >
        <UtilityFlyout>
          <ReferralDropdown apiKey={apiKey} iconOnly={collapsed} />
        </UtilityFlyout>
        {apiKey ? (
          <UtilityFlyout>
            <NotificationBell apiKey={apiKey} />
          </UtilityFlyout>
        ) : null}
        <UtilityFlyout>
          <SystemStatusIndicator apiKey={apiKey} />
        </UtilityFlyout>
      </div>
      <UtilityFlyout>
        <SettingsRow t={t} toggleDarkMode={toggleDarkMode} languageCompact />
      </UtilityFlyout>
    </div>
  );
}

function SidebarNav({ nav, isActive, getLabel, onNavigate }) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-2">
      <SidebarNavSection items={nav.primary} isActive={isActive} getLabel={getLabel} onNavigate={onNavigate} />
      <SidebarNavSection
        items={nav.secondary}
        isActive={isActive}
        getLabel={getLabel}
        onNavigate={onNavigate}
        className="mt-1"
      />
    </nav>
  );
}

function DesktopSidebar({ apiKey, nav, isActive, getLabel, t, toggleDarkMode, collapsed }) {
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/60 bg-surface/85 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark/85 md:flex"
      style={{ width: sidebarWidth }}
      aria-label={t('title')}
    >
      <div
        className={`shrink-0 border-b border-border/40 py-3 dark:border-border-dark/40 ${
          collapsed ? 'flex flex-col items-center gap-2 px-2' : 'flex items-center gap-1 px-2'
        }`}
      >
        <div className={collapsed ? 'w-full flex justify-center' : 'min-w-0 flex-1'}>
          <SidebarBrand />
        </div>
        <SidebarCollapseToggle />
      </div>
      <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} />
      <SidebarUtilities apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} layout="row" />
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
          collapsed={hydrated && collapsed}
        />

        {/* Mobile top bar */}
        <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-border/60 bg-surface/90 px-3 py-2.5 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 md:hidden">
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
          className={`fixed inset-0 z-[255] bg-black/50 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
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
            className={`fixed inset-y-0 left-0 z-[260] flex w-[min(100vw-3rem,18rem)] flex-col border-r border-border/60 bg-surface/95 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark/95 md:hidden ${
              isDrawerOpen
                ? 'pointer-events-auto translate-x-0'
                : 'pointer-events-none -translate-x-full'
            }`}
          >
            <div className="shrink-0 border-b border-border/40 px-3 py-4 dark:border-border-dark/40">
              <SidebarBrand />
            </div>
            <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} onNavigate={closeDrawer} />
            <SidebarUtilities
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
