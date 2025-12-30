'use client';

import { useState } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function ApiKeyInput({
  value,
  onKeyChange,
}) {
  const t = useTranslations('ApiKeyInput');
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="relative">
      <input
        type={showKey ? 'text' : 'password'}
        value={value}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder={t('placeholder')}
        className="w-full px-4 py-3 pr-12 md:p-3 text-sm md:text-base border border-border dark:border-border-dark rounded-xl 
          bg-surface/50 dark:bg-surface-dark/50 text-primary-text dark:text-primary-text-dark 
          placeholder-primary-text/40 dark:placeholder-primary-text-dark/40
          focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
          focus:border-accent dark:focus:border-accent-dark
          transition-all font-mono"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShowKey(!showKey)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-text/30 
          dark:text-primary-text-dark/30 hover:text-primary 
          transition-colors p-2"
        aria-label={showKey ? t('hide') : t('show')}
      >
        {showKey ? <Icons.Eye className="w-5 h-5" /> : <Icons.EyeOff className="w-5 h-5" />}
      </button>
    </div>
  );
}
