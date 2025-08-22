'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';

const REFERRAL_CODE = '09c3f0f3-4e61-4634-a6dc-40af39f8165c';
const REFERRAL_LINK = 'https://torbox.app/subscription?referral=09c3f0f3-4e61-4634-a6dc-40af39f8165c';

export default function ReferralDropdown() {
  const t = useTranslations('Referral');
  const [isOpen, setIsOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
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

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-white dark:text-primary-text-dark hover:text-white/80 dark:hover:text-primary-text-dark/80 transition-colors"
      >
        <Icons.Gift className="w-4 h-4" />
        <span className="text-sm hidden sm:inline">{t('referral')}</span>
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
        <div className="absolute right-0 z-50 mt-2 py-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-surface-alt-dark rounded-md shadow-lg border border-primary-border dark:border-border-dark">
          <div className="px-4 py-3 border-b border-border dark:border-border-dark">
            <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
              {t('title')}
            </h3>
            <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 mt-1">
              {t('description')}
            </p>
          </div>

          <div className="p-4 space-y-3">
            {/* Referral Code */}
            <div>
              <label className="block text-xs font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('referralCode')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={REFERRAL_CODE}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-border dark:border-border-dark rounded-md text-primary-text dark:text-primary-text-dark font-mono"
                />
                <button
                  onClick={() => copyToClipboard(REFERRAL_CODE, 'code')}
                  className="p-2 text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 rounded-md transition-colors"
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

            {/* Referral Link */}
            <div>
              <label className="block text-xs font-medium text-primary-text dark:text-primary-text-dark mb-2">
                {t('referralLink')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={REFERRAL_LINK}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-border dark:border-border-dark rounded-md text-primary-text dark:text-primary-text-dark font-mono truncate"
                />
                <a
                  href={REFERRAL_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 rounded-md transition-colors"
                  title={t('visitLink')}
                >
                  <Icons.ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
