'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Cog, Filter } from '@/components/icons';

export default function SearchBarQuickOptions({
  includeCustomEngines,
  onCustomEnginesToggle,
  showAdvancedOptions,
  onToggleAdvancedOptions,
}) {
  const t = useTranslations('SearchBar');
  const customEnginesSwitchId = useId();

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <label htmlFor={customEnginesSwitchId} className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            <Cog className="size-4" />
            {t('customEngines')}
          </span>
          <div
            id={customEnginesSwitchId}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
                ${
                  includeCustomEngines
                    ? 'bg-accent dark:bg-accent-dark'
                    : 'bg-border dark:bg-border-dark'
                }`}
            onClick={onCustomEnginesToggle}
            role="switch"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onCustomEnginesToggle();
              }
            }}
            aria-checked={includeCustomEngines}
          >
            <span
              className={`inline-block size-4 transform rounded-full bg-white transition-transform
                  ${includeCustomEngines ? 'translate-x-4' : 'translate-x-1'}`}
            />
          </div>
        </label>

        <button
          type="button"
          onClick={onToggleAdvancedOptions}
          className="flex items-center gap-1 text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
        >
          <Filter className="size-4" />
          {showAdvancedOptions
            ? t('hideAdvanced') || 'Hide Advanced'
            : t('showAdvanced') || 'Show Advanced'}
        </button>
      </div>
    </div>
  );
}
