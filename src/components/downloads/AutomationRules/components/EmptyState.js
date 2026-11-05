'use client';

import { Bolt } from '@/components/icons';
import { useTranslations } from 'next-intl';
import EmptyStateCard from '@/components/shared/EmptyStateCard';
import PresetRulesSection from './PresetRulesSection';

export default function EmptyState({ isBackendMode, onCreateRule, onApplyPreset, presetT }) {
  const t = useTranslations('AutomationRules');

  return (
    <EmptyStateCard
      icon={Bolt}
      title={t('emptyState.title')}
      description={t('emptyState.description')}
      notesTitle={t('emptyState.howItWorks')}
      notes={[t('emptyState.step1'), t('emptyState.step2'), t('emptyState.step3')]}
    >
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
    </EmptyStateCard>
  );
}
