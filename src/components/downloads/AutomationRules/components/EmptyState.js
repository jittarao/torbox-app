'use client';

import { Bolt } from '@/components/icons';
import { useTranslations } from 'next-intl';
import PresetRulesSection from './PresetRulesSection';

export default function EmptyState({ isBackendMode, onCreateRule, onApplyPreset, presetT }) {
  const t = useTranslations('AutomationRules');

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-8 md:p-12">
      <div className="text-center">
        <Bolt className="size-16 mx-auto mb-4 text-primary-text/40 dark:text-primary-text-dark/40" />
        <h2 className="text-lg font-medium text-primary-text dark:text-primary-text-dark mb-2">
          {t('emptyState.title')}
        </h2>
        <p className="text-md text-primary-text/70 dark:text-primary-text-dark/70 max-w-xl mx-auto mb-4">
          {t('emptyState.description')}
        </p>
        <div className="mt-6 p-4 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
          <p className="text-md text-primary-text/60 dark:text-primary-text-dark/60 mb-2">
            <strong className="text-primary-text dark:text-primary-text-dark">
              {t('emptyState.howItWorks')}
            </strong>
          </p>
          <ul className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 text-left space-y-1 max-w-md mx-auto">
            <li>• {t('emptyState.step1')}</li>
            <li>• {t('emptyState.step2')}</li>
            <li>• {t('emptyState.step3')}</li>
          </ul>
        </div>

        {!isBackendMode && (
          <div className="mt-6 p-4 rounded-lg border border-label-warning-text/25 bg-label-warning-bg dark:bg-label-warning-bg-dark text-left max-w-xl mx-auto">
            <p className="text-sm font-medium text-label-warning-text dark:text-label-warning-text-dark mb-1">
              {t('emptyState.backendRequired')}
            </p>
            <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
              {t('emptyState.backendRequiredDescription')}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onCreateRule}
          className="mt-6 inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90 transition-colors"
        >
          + {t('emptyState.createFirstRule')}
        </button>

        <div className="mt-8 text-left">
          <PresetRulesSection onApplyPreset={onApplyPreset} t={presetT} />
        </div>
      </div>
    </div>
  );
}
