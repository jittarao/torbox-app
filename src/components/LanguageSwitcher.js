'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useRef, useEffect, useCallback } from 'react';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';
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

export default function LanguageSwitcher({ iconOnly = false, variant = 'default' }) {
  const locale = useLocale();
  const t = useTranslations('Header');
  const currentLanguage = languages[locale];
  const pathname = usePathname();
  const { push } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage && savedLanguage !== locale) {
      const newPath = pathname.replace(locale, savedLanguage);
      push(newPath);
    }
  }, [locale, pathname, push]);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useHeaderDropdownDismiss({ isOpen, onClose: closeDropdown, anchorRef: dropdownRef });

  const handleLanguageChange = (newLocale) => {
    setIsOpen(false);
    localStorage.setItem('preferredLanguage', newLocale);
    push(pathname.replace(locale, newLocale));
  };

  const sidebarCell = variant === 'sidebar-cell';
  const sidebarControl = variant === 'sidebar-control';
  const showLocaleCode = (sidebarCell || sidebarControl) && !iconOnly;
  const languageLabel = t('menu.language');

  const flagSize = iconOnly
    ? { width: 20, height: 14 }
    : sidebarCell
      ? { width: 28, height: 18 }
      : { width: 24, height: 16 };

  return (
    <div
      className={`relative z-[260] shrink-0 ${sidebarCell ? 'w-full' : ''} ${
        sidebarControl ? 'min-w-0 flex-1' : ''
      }`}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          iconOnly
            ? 'ui-header-icon-btn'
            : sidebarCell
              ? 'ui-sidebar-pref-cell'
              : sidebarControl
                ? 'ui-sidebar-language-control'
                : 'flex items-center gap-2 text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300'
        }
        aria-label={iconOnly || sidebarControl ? languageLabel : undefined}
        title={iconOnly || sidebarControl ? currentLanguage.name : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Image
          src={currentLanguage.flag}
          alt=""
          width={flagSize.width}
          height={flagSize.height}
          className={`shrink-0 rounded-sm object-cover ring-1 ring-black/10 dark:ring-white/10 ${
            iconOnly ? 'h-[14px] w-5' : ''
          }`}
          aria-hidden
        />
        {showLocaleCode ? (
          <span className="text-xs font-medium uppercase tracking-wide">{locale}</span>
        ) : !iconOnly && !sidebarCell && !sidebarControl ? (
          <span className="text-sm">{currentLanguage.name}</span>
        ) : null}
        {!sidebarCell && !sidebarControl && !iconOnly ? (
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : null}
      </button>

      <HeaderDropdownPanel
        open={isOpen}
        placement="sidebar"
        onBackdropClick={() => setIsOpen(false)}
      >
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
