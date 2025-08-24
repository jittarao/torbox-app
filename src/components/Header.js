'use client';

import { useEffect, useState } from 'react';
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

export default function Header({ apiKey }) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const { darkMode, toggleDarkMode, isClient } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
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
            <h1 className="text-xl text-white dark:text-primary-text-dark font-medium">
              {t('title')}
            </h1>
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
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/' || locales.some((locale) => pathname === `/${locale}`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.Download />
              {t('menu.downloads')}
            </Link>

            <Link
              href="/search"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/search' || locales.some((locale) => pathname === `/${locale}/search`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.MagnifyingGlass />
              {t('menu.search')}
            </Link>

            <Link
              href="/archived"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/archived' || locales.some((locale) => pathname === `/${locale}/archived`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.Archive />
              {t('menu.archived')}
            </Link>

            <Link
              href="/link-history"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/link-history' || locales.some((locale) => pathname === `/${locale}/link-history`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.History />
              {t('menu.linkHistory')}
            </Link>

            <Link
              href="/rss"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/rss' || locales.some((locale) => pathname === `/${locale}/rss`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.Rss />
              {t('menu.rss')}
            </Link>

            {/* Speedtest temporarily hidden - will be reimplemented later
            <Link
              href="/speedtest"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/speedtest' || locales.some((locale) => pathname === `/${locale}/speedtest`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.Speed />
              {t('menu.speedtest')}
            </Link>
            */}

            <Link
              href="/user"
              className={`text-white dark:text-primary-text-dark font-medium flex items-center gap-2
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
                ${pathname === '/user' || locales.some((locale) => pathname === `/${locale}/user`) ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
            >
              <Icons.User />
              {t('menu.user')}
            </Link>

            {/* Divider */}
            <div className="h-4 w-px bg-primary-border dark:bg-border-dark"></div>

            {/* Dark mode toggle, Notifications, and Language Switcher */}
            <div className="flex items-center gap-4">
              <SystemStatusIndicator apiKey={apiKey} />
              {apiKey && <NotificationBell apiKey={apiKey} />}
              <ReferralDropdown />
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
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 space-y-4">
            <Link
              href="/"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/' || locales.some((locale) => pathname === `/${locale}`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.downloads')}
            </Link>

            <Link
              href="/search"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/search' || locales.some((locale) => pathname === `/${locale}/search`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.search')}
            </Link>

            <Link
              href="/link-history"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/link-history' || locales.some((locale) => pathname === `/${locale}/link-history`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.linkHistory')}
            </Link>

            <Link
              href="/user"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/user' || locales.some((locale) => pathname === `/${locale}/user`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.user')}
            </Link>

            <Link
              href="/rss"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/rss' || locales.some((locale) => pathname === `/${locale}/rss`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.rss')}
            </Link>

            {/* Speedtest temporarily hidden - will be reimplemented later
            <Link
              href="/speedtest"
              className={`block text-white dark:text-primary-text-dark font-medium 
                hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors py-2
                ${pathname === '/speedtest' || locales.some((locale) => pathname === `/${locale}/speedtest`) ? 'border-l-2 pl-2 border-accent dark:border-accent-dark' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              {t('menu.speedtest')}
            </Link>
            */}
            <div className="py-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white dark:text-primary-text-dark">
                  {t('menu.systemStatus')}
                </span>
                <SystemStatusIndicator apiKey={apiKey} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white dark:text-primary-text-dark">
                  {t('menu.referrals')}
                </span>
                <ReferralDropdown />
              </div>
              {isClient && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white dark:text-primary-text-dark">
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
                  <LanguageSwitcher />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
