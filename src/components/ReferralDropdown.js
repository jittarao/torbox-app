'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { REFERRAL_CODE, REFERRAL_LINK } from '@/components/constants';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';

export default function ReferralDropdown() {
  const t = useTranslations('Referral');
  const [isOpen, setIsOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState(null);
  const dropdownRef = useRef(null);

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

  const copyToClipboard = async (text, item) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative z-[260] shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ui-btn-ghost !gap-2"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Icons.Gift className="w-4 h-4" />
        <span className="text-sm hidden lg:inline">{t('referral')}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <HeaderDropdownPanel
        open={isOpen}
        widthClass="w-80 max-w-[calc(100vw-2rem)]"
        className="!py-0"
        onBackdropClick={() => setIsOpen(false)}
      >
        <div className="ui-dropdown-header">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('title')}</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{t('description')}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-medium">
            {t('developerNote')}
          </p>
        </div>

        <div className="ui-dropdown-body space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              {t('referralCode')}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={REFERRAL_CODE}
                readOnly
                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-mono text-zinc-800 dark:border-zinc-600 dark:bg-[#232326] dark:text-zinc-200"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(REFERRAL_CODE, 'code')}
                className="ui-header-icon-btn shrink-0"
                title={t('copyCode')}
              >
                {copiedItem === 'code' ? (
                  <Icons.Check className="w-4 h-4" />
                ) : (
                  <Icons.Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              {t('referralLink')}
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={REFERRAL_LINK}
                readOnly
                className="flex-1 min-w-0 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-mono text-zinc-800 break-all dark:border-zinc-600 dark:bg-[#232326] dark:text-zinc-200"
              />
              <a
                href={REFERRAL_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-header-icon-btn shrink-0"
                title={t('visitLink')}
              >
                <Icons.ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </HeaderDropdownPanel>
    </div>
  );
}
