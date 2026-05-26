'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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

function SidebarBrand() {
  const t = useTranslations('Header');

  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-white/[0.04]"
    >
      <Image
        src="/images/TBM-logo.png"
        alt={t('logo')}
        width={28}
        height={28}
        className="shrink-0"
      />
      <div className="flex min-w-0 flex-col">
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

function SettingsRow({ t, toggleDarkMode, languageCompact = true }) {
  return (
    <div className="flex items-center gap-1">
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
      <LanguageSwitcher compact={languageCompact} />
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
  );
}

function SidebarUtilities({ apiKey, t, toggleDarkMode, layout = 'row' }) {
  if (layout === 'mobile') {
    return (
      <div className="space-y-3 border-t border-border/60 px-4 py-4 dark:border-border-dark/60">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('menu.referrals')}
          </span>
          <div className="ui-sidebar-flyout-anchor relative z-[260]">
            <ReferralDropdown apiKey={apiKey} />
          </div>
        </div>
        {apiKey ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t('menu.notifications')}
            </span>
            <div className="ui-sidebar-flyout-anchor relative z-[260]">
              <NotificationBell apiKey={apiKey} />
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t('menu.systemStatus')}
          </span>
          <div className="ui-sidebar-flyout-anchor relative z-[260]">
            <SystemStatusIndicator apiKey={apiKey} />
          </div>
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
    <div className="border-t border-border/60 px-3 py-3 dark:border-border-dark/60">
      <div className="ui-sidebar-flyout-anchor relative z-[260] mb-2 flex flex-wrap items-center gap-1">
        <ReferralDropdown apiKey={apiKey} />
        {apiKey ? <NotificationBell apiKey={apiKey} /> : null}
        <SystemStatusIndicator apiKey={apiKey} />
      </div>
      <div className="ui-sidebar-flyout-anchor relative z-[260]">
        <SettingsRow t={t} toggleDarkMode={toggleDarkMode} languageCompact />
      </div>
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

export default function AppShell({ apiKey, children, className = '' }) {
  const { searchPageDisabled } = useFeatureFlags();
  const t = useTranslations('Header');
  const { isActive, pathname } = useNavActive();
  const { toggleDarkMode } = useTheme();
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

  return (
    <div
      className={shellClass}
      style={{ '--sidebar-width': '16rem' }}
    >
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/60 bg-surface/85 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/85 md:flex"
        style={{ width: 'var(--sidebar-width)' }}
        aria-label={t('title')}
      >
        <div className="shrink-0 border-b border-border/40 px-3 py-4 dark:border-border-dark/40">
          <SidebarBrand />
        </div>
        <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} />
        <SidebarUtilities apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} layout="row" />
      </aside>

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
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDrawer}
        aria-hidden={!isDrawerOpen}
      />

      {/* Mobile drawer */}
      <div
        id="app-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.toggle')}
        aria-hidden={!isDrawerOpen}
        className={`fixed inset-y-0 left-0 z-[260] flex w-[min(100vw-3rem,18rem)] flex-col border-r border-border/60 bg-surface/95 backdrop-blur-xl transition-transform duration-200 ease-out dark:border-border-dark/60 dark:bg-surface-dark/95 md:hidden ${
          isDrawerOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
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

      {/* Main content */}
      <div className="flex min-h-screen min-w-0 flex-col md:pl-[var(--sidebar-width)]">
        <ReferralHeaderBanner apiKey={apiKey} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
