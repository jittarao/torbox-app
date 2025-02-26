'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function Header() {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check initial theme
    const isDark =
      localStorage.getItem('darkMode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    document.documentElement.classList.toggle('dark', newDarkMode);
  };

  return (
    <div className="bg-primary dark:bg-surface-alt-dark border-b border-primary-border dark:border-border-dark">
      <div className="container mx-auto flex justify-between items-center px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/images/TBM-logo.png"
            alt="TorBox Manager Logo"
            width={24}
            height={24}
          />
          <h1 className="text-xl text-white dark:text-primary-text-dark font-medium">
            TorBox Manager
          </h1>
        </div>
        <div className="flex items-center gap-6">
          {/* Links */}
          <Link
            href="/"
            className={`text-white dark:text-primary-text-dark font-medium 
              hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
              ${pathname === '/' ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
          >
            Magnets
          </Link>

          <Link
            href="/search"
            className={`text-white dark:text-primary-text-dark font-medium 
              hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors pb-2
              ${pathname === '/search' ? 'border-b-2 border-accent dark:border-accent-dark' : ''}`}
          >
            Search
          </Link>

          {/* Divider */}
          <div className="h-4 w-px bg-primary-border dark:bg-border-dark"></div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
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
      </div>
    </div>
  );
}
