'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import { headerDropdownItemClass } from '@/components/shared/headerDropdownClasses';

const languages = {
  en: { name: 'English', flag: '/images/flags/flag-en.png' },
  es: { name: 'Español', flag: '/images/flags/flag-es.png' },
  de: { name: 'Deutsch', flag: '/images/flags/flag-de.png' },
  fr: { name: 'Français', flag: '/images/flags/flag-fr.png' },
  ja: { name: '日本語', flag: '/images/flags/flag-ja.png' },
  pl: { name: 'Polski', flag: '/images/flags/flag-pl.png' },
};

export default function LanguageSwitcher({ compact = false }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage && savedLanguage !== locale) {
      const newPath = pathname.replace(locale, savedLanguage);
      router.push(newPath);
    }
  }, [locale, pathname, router]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current?.contains(event.target)) return;
      if (event.target.closest('[data-header-dropdown-panel]')) return;
      setIsOpen(false);
    };

    const handleResize = () => {
      if (isOpen) setIsOpen(false);
    };

    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleLanguageChange = (newLocale) => {
    setIsOpen(false);
    localStorage.setItem('preferredLanguage', newLocale);
    router.push(pathname.replace(locale, newLocale));
  };

  return (
    <div className="relative z-[260] shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          compact
            ? 'ui-btn-ghost !gap-2'
            : 'flex items-center gap-2 text-zinc-900 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors'
        }
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Image
          src={languages[locale].flag}
          alt={languages[locale].name}
          width={24}
          height={16}
          className="rounded-sm"
        />
        {compact ? (
          <span className="hidden xl:inline text-sm font-medium uppercase">{locale}</span>
        ) : (
          <span className="text-sm">{languages[locale].name}</span>
        )}
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <HeaderDropdownPanel open={isOpen} onBackdropClick={() => setIsOpen(false)}>
        {Object.entries(languages).map(([code, { name, flag }]) => (
          <button
            key={code}
            type="button"
            onClick={() => handleLanguageChange(code)}
            className={headerDropdownItemClass(locale === code)}
            role="menuitem"
          >
            <Image src={flag} alt={name} width={24} height={16} className="rounded-sm shrink-0" />
            <span>{name}</span>
          </button>
        ))}
      </HeaderDropdownPanel>
    </div>
  );
}
