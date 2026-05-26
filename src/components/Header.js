'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Icons from '@/components/icons';
import { locales } from '@/i18n/settings';
import NotificationBell from '@/components/notifications/NotificationBell';
import SystemStatusIndicator from '@/components/shared/SystemStatusIndicator';
import ReferralDropdown from '@/components/ReferralDropdown';
import ReferralHeaderBanner from '@/components/referral/ReferralHeaderBanner';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import { headerDropdownItemClass } from '@/components/shared/headerDropdownClasses';
import { GITHUB_REPO_URL } from '@/components/constants';
import { useTheme } from '@/contexts/ThemeContext';
import { getVersion } from '@/utils/version';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
// import CloudUploadManager from '@/components/downloads/CloudUploadManager';

export default function Header({ apiKey }) {
  const { searchPageDisabled } = useFeatureFlags();
  const t = useTranslations('Header');
  const pathname = usePathname();
  const { toggleDarkMode } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMoreMenu = useCallback(() => setIsMoreMenuOpen(false), []);
  useHeaderDropdownDismiss({
    isOpen: isMoreMenuOpen,
    onClose: closeMoreMenu,
    anchorRef: moreMenuRef,
    closeOnScroll: false,
  });

  const isActive = (path) => {
    // Handle root path specially - it can be `/` or `/${locale}`
    if (path === '/') {
      return (
        pathname === '/' ||
        locales.some((locale) => pathname === `/${locale}` || pathname === `/${locale}/`)
      );
    }
    return pathname === path || locales.some((locale) => pathname === `/${locale}${path}`);
  };

  const navLinkClass = (active) => (active ? 'ui-header-nav-active' : 'ui-header-nav');

  return (
    <div className="relative z-40 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark overflow-x-clip">
      <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex justify-between items-center gap-2 min-w-0">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2">
            <Image
              src="/images/TBM-logo.png"
              alt={t('logo')}
              width={24}
              height={24}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-col">
              <h1 className="text-base sm:text-xl text-primary-text dark:text-primary-text-dark font-medium truncate">
                {t('title')}
              </h1>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal truncate">
                v{getVersion()}
              </span>
            </div>
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={toggleMenu}
            aria-label={t('menu.toggle')}
            className="ui-header-icon-btn md:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="w-6 h-6"
            >
              {isMenuOpen ? (
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-3 min-w-0 flex-1 justify-end">
            {/* Tier 1: Primary Navigation */}
            <div className="flex items-center gap-0.5 lg:gap-2 shrink-0">
              <Link href="/" className={navLinkClass(isActive('/'))} title={t('menu.downloads')}>
                <Icons.Download className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline">{t('menu.downloads')}</span>
              </Link>

              {!searchPageDisabled && (
                <Link
                  href="/search"
                  className={navLinkClass(isActive('/search'))}
                  title={t('menu.search')}
                >
                  <Icons.MagnifyingGlass className="w-5 h-5 shrink-0" />
                  <span className="hidden lg:inline">{t('menu.search')}</span>
                </Link>
              )}

              {/* More Menu Dropdown */}
              <div className="relative z-[260]" ref={moreMenuRef}>
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`${navLinkClass(
                    isActive('/archived') ||
                      isActive('/automation') ||
                      isActive('/link-history') ||
                      isActive('/rss') ||
                      isActive('/user') ||
                      isActive('/uploads')
                  )}`}
                  aria-expanded={isMoreMenuOpen}
                  aria-haspopup="menu"
                  title={t('menu.more') || 'More'}
                >
                  <Icons.VerticalEllipsis className="w-5 h-5" />
                  <span className="hidden lg:inline">{t('menu.more') || 'More'}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <HeaderDropdownPanel open={isMoreMenuOpen}>
                  <Link
                    href="/user"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/user'))}
                    role="menuitem"
                  >
                    <Icons.User className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.user')}</span>
                  </Link>

                  <Link
                    href="/link-history"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/link-history'))}
                    role="menuitem"
                  >
                    <Icons.History className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.linkHistory')}</span>
                  </Link>

                  <Link
                    href="/archived"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/archived'))}
                    role="menuitem"
                  >
                    <Icons.Archive className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.archived')}</span>
                  </Link>

                  <Link
                    href="/rss"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/rss'))}
                    role="menuitem"
                  >
                    <Icons.Rss className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.rss')}</span>
                  </Link>

                  <Link
                    href="/automation"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/automation'))}
                    role="menuitem"
                  >
                    <Icons.Bolt className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.automation')}</span>
                  </Link>

                  <Link
                    href="/uploads"
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={headerDropdownItemClass(isActive('/uploads'))}
                    role="menuitem"
                  >
                    <Icons.Upload className="w-4 h-4 shrink-0 opacity-80" />
                    <span>{t('menu.uploads')}</span>
                  </Link>
                </HeaderDropdownPanel>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block h-4 w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

            {/* Tier 1: Utility Items */}
            <div className="relative z-[260] flex items-center gap-0.5 lg:gap-1 shrink-0">
              <ReferralDropdown apiKey={apiKey} />
              {apiKey && <NotificationBell apiKey={apiKey} />}
              <SystemStatusIndicator apiKey={apiKey} />
            </div>

            {/* Divider */}
            <div className="hidden lg:block h-4 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800"></div>

            {/* Settings: Dark mode toggle and Language Switcher */}
            <div className="relative z-[260] flex items-center gap-1 lg:gap-2 shrink-0">
              <button
                onClick={toggleDarkMode}
                aria-label={t('theme.toggle')}
                className="ui-theme-toggle shrink-0"
              >
                <span className="ui-theme-toggle-knob">
                  <Icons.Sun className="block dark:hidden w-4 h-4" />
                  <Icons.Moon className="hidden dark:block w-4 h-4" />
                </span>
              </button>
              <LanguageSwitcher compact={true} />
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Repository"
                className="ui-header-icon-btn"
              >
                <Icons.GitHub className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 space-y-4">
            {/* Tier 1: Primary Navigation */}
            <div className="space-y-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <Link
                href="/"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Download className="w-5 h-5" />
                  {t('menu.downloads')}
                </div>
              </Link>

              {!searchPageDisabled && (
                <Link
                  href="/search"
                  className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/search') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <Icons.MagnifyingGlass className="w-5 h-5" />
                    {t('menu.search')}
                  </div>
                </Link>
              )}
            </div>

            {/* Tier 1: Secondary Navigation */}
            <div className="space-y-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <Link
                href="/user"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/user') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.User className="w-5 h-5" />
                  {t('menu.user')}
                </div>
              </Link>

              <Link
                href="/link-history"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/link-history') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.History className="w-5 h-5" />
                  {t('menu.linkHistory')}
                </div>
              </Link>

              <Link
                href="/archived"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/archived') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Archive className="w-5 h-5" />
                  {t('menu.archived')}
                </div>
              </Link>

              <Link
                href="/rss"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/rss') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Rss className="w-5 h-5" />
                  {t('menu.rss')}
                </div>
              </Link>

              <Link
                href="/automation"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/automation') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Bolt className="w-5 h-5" />
                  {t('menu.automation')}
                </div>
              </Link>

              <Link
                href="/uploads"
                className={`block text-zinc-900 dark:text-zinc-100 font-medium 
                  hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors py-2
                  ${isActive('/uploads') ? 'border-l-2 pl-2 border-amber-500 text-amber-400' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Upload className="w-5 h-5" />
                  {t('menu.uploads')}
                </div>
              </Link>
            </div>

            {/* Tier 2: Utility Items */}
            <div className="space-y-2 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {t('menu.referrals')}
                </span>
                <ReferralDropdown apiKey={apiKey} />
              </div>
              {apiKey && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                    {t('menu.notifications')}
                  </span>
                  <NotificationBell apiKey={apiKey} />
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {t('menu.systemStatus')}
                </span>
                <SystemStatusIndicator apiKey={apiKey} />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {t('theme.toggle')}
                </span>
                <button
                  onClick={toggleDarkMode}
                  aria-label={t('theme.toggle')}
                  className="ui-theme-toggle"
                >
                  <span className="ui-theme-toggle-knob">
                    <Icons.Sun className="block dark:hidden w-4 h-4" />
                    <Icons.Moon className="hidden dark:block w-4 h-4" />
                  </span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">
                  {t('menu.language') || 'Language'}
                </span>
                <LanguageSwitcher />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">GitHub</span>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Repository"
                  className="ui-header-icon-btn"
                >
                  <Icons.GitHub className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        )}

        <ReferralHeaderBanner apiKey={apiKey} />
      </div>
    </div>
  );
}
