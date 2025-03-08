'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Icons from '@/components/icons';
import { locales } from '@/i18n/settings';

export default function Header() {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Set isClient to true once component is mounted
    setIsClient(true);

    // Check initial theme
    const isDark =
      localStorage.getItem('darkMode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Only render the toggle button client-side
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="bg-primary dark:bg-surface-alt-dark border-b border-primary-border dark:border-border-dark">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src="/images/TBM-logo.png"
              alt={t('logo')}
              width={24}
              height={24}
            />
            <h1 className="text-xl text-white dark:text-primary-text-dark font-medium">
              {t('title')}
            </h1>
          </div>

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

            {/* Divider */}
            <div className="h-4 w-px bg-primary-border dark:bg-border-dark"></div>

            {/* Dark mode toggle and Language Switcher */}
            <div className="flex items-center gap-4">
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
                    {darkMode ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary-text-dark"
                      >
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary-text"
                      >
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2" />
                        <path d="M12 20v2" />
                        <path d="m4.93 4.93 1.41 1.41" />
                        <path d="m17.66 17.66 1.41 1.41" />
                        <path d="M2 12h2" />
                        <path d="M20 12h2" />
                        <path d="m6.34 17.66-1.41 1.41" />
                        <path d="m19.07 4.93-1.41 1.41" />
                      </svg>
                    )}
                  </span>
                </button>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 space-y-4 animate-slide-up">
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

            <div className="py-2 space-y-4">
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
                        {darkMode ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary-text-dark"
                          >
                            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-primary-text"
                          >
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2" />
                            <path d="M12 20v2" />
                            <path d="m4.93 4.93 1.41 1.41" />
                            <path d="m17.66 17.66 1.41 1.41" />
                            <path d="M2 12h2" />
                            <path d="M20 12h2" />
                            <path d="m6.34 17.66-1.41 1.41" />
                            <path d="m19.07 4.93-1.41 1.41" />
                          </svg>
                        )}
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
