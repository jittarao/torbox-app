'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';

const languages = {
  en: { name: 'English', flag: '/images/flags/flag-en.png' },
  es: { name: 'Español', flag: '/images/flags/flag-es.png' },
  de: { name: 'Deutsch', flag: '/images/flags/flag-de.png' },
  fr: { name: 'Français', flag: '/images/flags/flag-fr.png' },
  ja: { name: '日本語', flag: '/images/flags/flag-ja.png' },
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLocale) => {
    setIsOpen(false);
    router.push(pathname.replace(locale, newLocale));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-white dark:text-primary-text-dark hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors"
      >
        <Image
          src={languages[locale].flag}
          alt={languages[locale].name}
          width={24}
          height={16}
        />
        <span className="text-sm">{languages[locale].name}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 py-2 w-48 bg-white dark:bg-surface-alt-dark rounded-md shadow-lg border border-primary-border dark:border-border-dark">
          {Object.entries(languages).map(([code, { name, flag }]) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code)}
              className={`flex w-full items-center gap-3 px-4 py-2 text-sm bg-surface-alt-selected dark:bg-surface-alt-selected-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark ${
                locale === code
                  ? 'text-accent dark:text-accent-dark'
                  : 'text-primary-text dark:text-primary-text-dark'
              }`}
            >
              <Image src={flag} alt={name} width={24} height={16} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
