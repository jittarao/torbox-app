'use client';

import { useState } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import ApiKeyManager from './ApiKeyManager';

export default function ApiKeyInput({
  value,
  onKeyChange,
  allowKeyManager = false,
}) {
  const t = useTranslations('ApiKeyInput');
  const [showKey, setShowKey] = useState(false);
  const [showManager, setShowManager] = useState(false);

  return (
    <div className="space-y-4">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full px-3 py-2 pr-12 md:p-3.5 text-sm md:text-base border border-border dark:border-border-dark rounded-lg 
              bg-transparent text-primary-text dark:text-primary-text-dark 
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
              focus:border-accent dark:focus:border-accent-dark
              transition-colors"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-primary-text/50 
              dark:text-primary-text-dark/50 hover:text-primary-text 
              dark:hover:text-primary-text-dark transition-colors
              p-2 touch-manipulation"
            aria-label={showKey ? t('hide') : t('show')}
          >
            {showKey ? <Icons.Eye /> : <Icons.EyeOff />}
          </button>
        </div>

        {allowKeyManager && (
          <button
            onClick={() => setShowManager(!showManager)}
            className={`px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark rounded-lg border border-border dark:border-border-dark
            hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors
            flex items-center gap-2 ${showManager ? 'bg-surface-alt dark:bg-surface-alt-dark' : ''}`}
            aria-label={t('manageKeys')}
          >
            <Icons.Preferences className="w-4 h-4" />
            <span className="hidden md:inline">{t('manageKeys')}</span>
          </button>
        )}
      </div>
      {showManager && (
        <ApiKeyManager
          onKeySelect={onKeyChange}
          activeKey={value}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
}
