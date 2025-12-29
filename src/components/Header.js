'use client';

import { useEffect, useState, useRef } from 'react';
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
import { useTheme } from '@/contexts/ThemeContext';
import { getVersion } from '@/utils/version';
// import CloudUploadManager from '@/components/downloads/CloudUploadManager';

export default function Header({ apiKey }) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const { darkMode, toggleDarkMode, isClient } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
    };

    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isMoreMenuOpen]);

  const isActive = (path) => {
    return pathname === path || locales.some((locale) => pathname === `/${locale}${path}`);
  };

  return (
    <div className="bg-primary dark:bg-surface-alt-dark border-b border-primary-border dark:border-border-dark">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/TBM-logo.png"
              alt={t('logo')}
              width={24}
              height={24}
            />
            <div className="flex flex-col">
              <h1 className="text-xl text-white dark:text-primary-text-dark font-medium">
                {t('title')}
              </h1>
              <span className="text-xs text-white/70 dark:text-primary-text-dark/70 font-normal">
                v{getVersion()}
              </span>
            </div>
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={toggleMenu}
            aria-label={t('menu.toggle')}
            className="md:hidden text-white dark:text-primary-text-dark"
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
          <div className="hidden md:flex items-center gap-4">
            {/* Tier 1: Primary Navigation */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors
                  ${isActive('/') ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
              >
                <Icons.Download />
                {t('menu.downloads')}
              </Link>

              <Link
                href="/search"
                className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors
                  ${isActive('/search') ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
              >
                <Icons.MagnifyingGlass />
                {t('menu.search')}
              </Link>

              {/* More Menu Dropdown */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                    hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors
                    ${isActive('/archived') || isActive('/link-history') || isActive('/rss') || isActive('/user') 
                      ? 'border-b-2 border-accent dark:border-accent-dark' 
                      : ''}`}
                >
                  <Icons.VerticalEllipsis className="w-5 h-5" />
                  <span>{t('menu.more') || 'More'}</span>
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

                {isMoreMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 py-2 w-48 bg-white dark:bg-surface-alt-dark rounded-md shadow-lg border border-primary-border dark:border-border-dark">
                    <Link
                      href="/user"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isActive('/user')
                          ? 'text-accent dark:text-accent-dark bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                          : 'text-primary-text dark:text-primary-text-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark'
                      }`}
                    >
                      <Icons.User className="w-4 h-4" />
                      <span>{t('menu.user')}</span>
                    </Link>

                    <Link
                      href="/link-history"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isActive('/link-history')
                          ? 'text-accent dark:text-accent-dark bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                          : 'text-primary-text dark:text-primary-text-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark'
                      }`}
                    >
                      <Icons.History className="w-4 h-4" />
                      <span>{t('menu.linkHistory')}</span>
                    </Link>

                    <Link
                      href="/archived"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isActive('/archived')
                          ? 'text-accent dark:text-accent-dark bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                          : 'text-primary-text dark:text-primary-text-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark'
                      }`}
                    >
                      <Icons.Archive className="w-4 h-4" />
                      <span>{t('menu.archived')}</span>
                    </Link>

                    <Link
                      href="/rss"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isActive('/rss')
                          ? 'text-accent dark:text-accent-dark bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                          : 'text-primary-text dark:text-primary-text-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark'
                      }`}
                    >
                      <Icons.Rss className="w-4 h-4" />
                      <span>{t('menu.rss')}</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-primary-border dark:bg-border-dark"></div>

            {/* Tier 1: Utility Items */}
            <div className="flex items-center gap-3">
              <ReferralDropdown />
              {apiKey && <NotificationBell apiKey={apiKey} />}
              <SystemStatusIndicator apiKey={apiKey} />
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-primary-border dark:bg-border-dark"></div>

            {/* Settings: Dark mode toggle and Language Switcher */}
            <div className="flex items-center gap-3">
              {isClient && (
                <button
                  onClick={toggleDarkMode}
                  aria-label={
                    darkMode ? t('theme.toggleLight') : t('theme.toggleDark')
                  }
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none bg-gray-200 dark:bg-gray-700"
                >
                  <span
                    className={`${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    } inline-flex items-center justify-center h-4 w-4 transform rounded-full transition-transform bg-white dark:bg-gray-800`}
                  >
                    {darkMode ? <Icons.Moon /> : <Icons.Sun />}
                  </span>
                </button>
              )}
              <LanguageSwitcher compact={true} />
              <a
                href="https://github.com/jittarao/torbox-app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Repository"
                className="text-white dark:text-primary-text-dark hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors"
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
            <div className="space-y-2 pb-4 border-b border-primary-border dark:border-border-dark">
              <Link
                href="/"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Download className="w-5 h-5" />
                  {t('menu.downloads')}
                </div>
              </Link>

              <Link
                href="/search"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/search') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.MagnifyingGlass className="w-5 h-5" />
                  {t('menu.search')}
                </div>
              </Link>
            </div>

            {/* Tier 1: Secondary Navigation */}
            <div className="space-y-2 pb-4 border-b border-primary-border dark:border-border-dark">
            <Link
                href="/user"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/user') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.User className="w-5 h-5" />
                  {t('menu.user')}
                </div>
              </Link>

              <Link
                href="/link-history"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/link-history') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.History className="w-5 h-5" />
                  {t('menu.linkHistory')}
                </div>
              </Link>

              <Link
                href="/archived"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/archived') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Archive className="w-5 h-5" />
                  {t('menu.archived')}
                </div>
              </Link>

              <Link
                href="/rss"
                className={`block text-white dark:text-primary-text-dark font-medium 
                  hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                  ${isActive('/rss') ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <Icons.Rss className="w-5 h-5" />
                  {t('menu.rss')}
                </div>
              </Link>
            </div>

            {/* Tier 2: Utility Items */}
            <div className="space-y-2 pb-4 border-b border-primary-border dark:border-border-dark">
              <div className="flex items-center justify-between py-2">
                <span className="text-white dark:text-primary-text-dark font-medium">
                  {t('menu.referrals')}
                </span>
                <ReferralDropdown />
              </div>
              {apiKey && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-white dark:text-primary-text-dark font-medium">
                    {t('menu.notifications')}
                  </span>
                  <NotificationBell apiKey={apiKey} />
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-white dark:text-primary-text-dark font-medium">
                  {t('menu.systemStatus')}
                </span>
                <SystemStatusIndicator apiKey={apiKey} />
              </div>
            </div>

            {/* Settings */}
            {isClient && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white dark:text-primary-text-dark font-medium">
                    {t('theme.toggleDark')}
                  </span>
                  <button
                    onClick={toggleDarkMode}
                    aria-label={
                      darkMode
                        ? t('theme.toggleLight')
                        : t('theme.toggleDark')
                    }
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none bg-gray-200 dark:bg-gray-700"
                  >
                    <span
                      className={`${
                        darkMode ? 'translate-x-6' : 'translate-x-1'
                      } inline-flex items-center justify-center h-4 w-4 transform rounded-full transition-transform bg-white dark:bg-gray-800`}
                    >
                      {darkMode ? <Icons.Moon /> : <Icons.Sun />}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white dark:text-primary-text-dark font-medium">
                    {t('menu.language') || 'Language'}
                  </span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white dark:text-primary-text-dark font-medium">
                    GitHub
                  </span>
                  <a
                    href="https://github.com/jittarao/torbox-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub Repository"
                    className="text-white dark:text-primary-text-dark hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors"
                  >
                    <Icons.GitHub className="w-5 h-5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
