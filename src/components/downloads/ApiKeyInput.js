'use client';

import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Preferences } from '@/components/icons';
import { useTranslations } from 'next-intl';
import ApiKeyManager from './ApiKeyManager';
import { ensureUserDb } from '@/utils/ensureUserDb';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { REFERRAL_CODE } from '@/config/referral';
import { applyReferralToAccount } from '@/utils/referralEligibility';
import { markReferralAppliedForKey, isReferralAppliedForKey } from '@/utils/referralApplied';
import { getItem, setItem } from '@/utils/storage';

export default function ApiKeyInput({
  value,
  onKeyChange,
  allowKeyManager = false,
  variant = 'default',
}) {
  const isLanding = variant === 'landing';
  const isCompact = variant === 'compact';
  const t = useTranslations('ApiKeyInput');
  const { onboardingAuxActive } = useFeatureFlags();
  const [showKey, setShowKey] = useState(false);
  const lastAutoApplyKeyRef = useRef('');
  const cachedKeepManagerOpen = getItem('torboxKeepManagerOpen') === 'true';
  const [showManager, setShowManager] = useState(() => cachedKeepManagerOpen);
  const [keepManagerOpen, setKeepManagerOpen] = useState(() => cachedKeepManagerOpen);
  const [draft, setDraft] = useState(undefined);
  const ensureDbTimeoutRef = useRef(null);

  const committedValue = value ?? '';
  const [prevCommittedValue, setPrevCommittedValue] = useState(committedValue);

  if (committedValue !== prevCommittedValue) {
    setPrevCommittedValue(committedValue);
    setDraft(undefined);
  }

  useEffect(() => {
    if (!onboardingAuxActive) return;
    if (!committedValue || !isValidTorboxApiKey(committedValue)) {
      return;
    }
    if (lastAutoApplyKeyRef.current === committedValue) return;
    if (isReferralAppliedForKey(committedValue)) return;

    lastAutoApplyKeyRef.current = committedValue;

    applyReferralToAccount(committedValue, REFERRAL_CODE).then((result) => {
      if (result.success || result.skipFutureAttempts) {
        markReferralAppliedForKey(committedValue);
      }
    });
  }, [committedValue, onboardingAuxActive]);

  // Save manager open state to localStorage
  const handleKeepManagerToggle = (keepOpen) => {
    setKeepManagerOpen(keepOpen);
    setItem('torboxKeepManagerOpen', keepOpen.toString());
  };

  // Ensure user database exists when API key is set
  useEffect(() => {
    // Clear any pending timeout
    if (ensureDbTimeoutRef.current) {
      clearTimeout(ensureDbTimeoutRef.current);
    }

    // Only ensure DB if we have a valid TorBox API key (UUID format)
    if (committedValue && isValidTorboxApiKey(committedValue)) {
      // Debounce the API call - wait 1 second after user stops typing
      ensureDbTimeoutRef.current = setTimeout(async () => {
        const result = await ensureUserDb(committedValue);
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
  }, [committedValue]);

  const displayValue = draft !== undefined ? draft : committedValue;

  const handleInputChange = (e) => {
    const raw = e.target.value;
    const trimmed = raw.trim();
    if (trimmed === '' || isValidTorboxApiKey(trimmed)) {
      setDraft(undefined);
      onKeyChange(trimmed);
    } else {
      setDraft(raw);
    }
  };

  const inputClassName = isLanding
    ? 'ui-input-landing pr-12 md:p-3 md:text-base'
    : isCompact
      ? `w-full h-8 px-2.5 pr-8 text-xs sm:text-sm rounded-md border-0
              bg-transparent text-primary-text dark:text-primary-text-dark
              placeholder-primary-text/45 dark:placeholder-primary-text-dark/45
              focus:outline-none focus:ring-1 focus:ring-accent/30 dark:focus:ring-accent-dark/30
              transition-colors`
      : `w-full px-3 py-2 pr-12 md:p-3 text-sm md:text-base border border-border dark:border-border-dark rounded-lg
              bg-transparent text-primary-text dark:text-primary-text-dark
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20
              focus:border-accent dark:focus:border-accent-dark
              transition-colors`;

  const eyeButtonClassName = isCompact
    ? 'absolute right-1 top-1/2 -translate-y-1/2 p-1 touch-manipulation transition-colors text-primary-text/45 dark:text-primary-text-dark/45 hover:text-primary-text dark:hover:text-primary-text-dark'
    : `absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-2 touch-manipulation transition-colors ${
        isLanding
          ? 'text-zinc-500 hover:text-amber-300'
          : 'text-primary-text/50 dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark'
      }`;

  const manageButtonClassName = isCompact
    ? `shrink-0 h-8 px-2 sm:px-2.5 text-xs text-primary-text/80 dark:text-primary-text-dark/80 rounded-md
            hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors
            flex items-center gap-1.5 ${showManager ? 'bg-surface-hover dark:bg-surface-hover-dark text-primary-text dark:text-primary-text-dark' : ''}`
    : `px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark rounded-lg border border-border dark:border-border-dark
            hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors
            flex items-center gap-2 ${showManager ? 'bg-surface-alt dark:bg-surface-alt-dark' : ''}`;

  const rowClassName = isCompact
    ? 'flex items-center gap-1 rounded-lg border border-border/60 dark:border-border-dark/60 bg-surface-alt/30 dark:bg-surface-alt-dark/30 p-0.5 sm:p-1'
    : 'relative flex gap-2';

  return (
    <div className={isCompact ? 'space-y-1.5' : 'space-y-4'}>
      <div className={rowClassName}>
        {isCompact && (
          <span className="hidden sm:flex shrink-0 items-center pl-2 text-[11px] font-medium uppercase tracking-wide text-primary-text/45 dark:text-primary-text-dark/45">
            {t('label')}
          </span>
        )}
        <div className="relative flex-1 min-w-0">
          <input
            type={showKey ? 'text' : 'password'}
            value={displayValue}
            onChange={handleInputChange}
            placeholder={t('placeholder')}
            className={inputClassName}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className={eyeButtonClassName}
            aria-label={showKey ? t('hide') : t('show')}
          >
            {showKey ? (
              <Eye className={isCompact ? 'w-3.5 h-3.5' : undefined} />
            ) : (
              <EyeOff className={isCompact ? 'w-3.5 h-3.5' : undefined} />
            )}
          </button>
        </div>

        {allowKeyManager && (
          <button
            type="button"
            onClick={() => setShowManager(!showManager)}
            className={manageButtonClassName}
            aria-label={t('manageKeys')}
            aria-expanded={showManager}
          >
            <Preferences className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            <span className="hidden md:inline">{t('manageKeys')}</span>
          </button>
        )}
      </div>

      {showManager && (
        <ApiKeyManager
          onKeySelect={onKeyChange}
          activeKey={committedValue}
          onClose={() => setShowManager(false)}
          keepOpen={keepManagerOpen}
          onKeepOpenToggle={handleKeepManagerToggle}
          compact={isCompact}
        />
      )}
    </div>
  );
}
