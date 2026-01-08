'use client';

import { useState, useEffect, useRef } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import ApiKeyManager from './ApiKeyManager';
import { ensureUserDb } from '@/utils/ensureUserDb';

export default function ApiKeyInput({
  value,
  onKeyChange,
  allowKeyManager = false,
}) {
  const t = useTranslations('ApiKeyInput');
  const [showKey, setShowKey] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [keepManagerOpen, setKeepManagerOpen] = useState(false);
  const ensureDbTimeoutRef = useRef(null);

  // Load manager open state from localStorage on mount
  useEffect(() => {
    const storedState = localStorage.getItem('torboxKeepManagerOpen');
    if (storedState === 'true') {
      setKeepManagerOpen(true);
      setShowManager(true);
    }
  }, []);

  // Save manager open state to localStorage
  const handleKeepManagerToggle = (keepOpen) => {
    setKeepManagerOpen(keepOpen);
    localStorage.setItem('torboxKeepManagerOpen', keepOpen.toString());
  };

  // Ensure user database exists when API key is set
  useEffect(() => {
    // Clear any pending timeout
    if (ensureDbTimeoutRef.current) {
      clearTimeout(ensureDbTimeoutRef.current);
    }

    // Only ensure DB if we have a valid-looking API key (at least 20 chars)
    if (value && value.length >= 20) {
      // Debounce the API call - wait 1 second after user stops typing
      ensureDbTimeoutRef.current = setTimeout(async () => {
        const result = await ensureUserDb(value);
        if (result.success && result.wasCreated) {
          console.log('User database created for API key');
        }
      }, 1000);
    }

    return () => {
      if (ensureDbTimeoutRef.current) {
        clearTimeout(ensureDbTimeoutRef.current);
      }
    };
  }, [value]);

  return (
    <div className="space-y-4">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full px-3 py-2 pr-12 md:p-3 text-sm md:text-base border border-border dark:border-border-dark rounded-lg 
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
          keepOpen={keepManagerOpen}
          onKeepOpenToggle={handleKeepManagerToggle}
        />
      )}
    </div>
  );
}
