'use client';

import type { WatchRule, WatchRuleStatus } from '@/desktop/capabilities';
import { ChevronDown, Trash } from '@/components/icons';
import {
  desktopBtnDanger,
  DesktopStatusBadge,
  DesktopToggle,
} from '@/components/desktop/DesktopUi';
import { getFolderLabel, getPostUploadActionLabel } from './desktopWatchRuleCardUtils';

type DesktopWatchRuleCardHeaderProps = {
  rule: WatchRule;
  ruleStatus: WatchRuleStatus | null;
  ruleIndex: number;
  expanded: boolean;
  canRemove: boolean;
  hasCredential: boolean;
  saving: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onToggleExpanded: () => void;
  onRemoveRule: () => void;
  onEnabledChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function DesktopWatchRuleCardHeader({
  rule,
  ruleStatus,
  ruleIndex,
  expanded,
  canRemove,
  hasCredential,
  saving,
  t,
  onToggleExpanded,
  onRemoveRule,
  onEnabledChange,
}: DesktopWatchRuleCardHeaderProps) {
  const folderLabel = getFolderLabel(rule.watchPath, t('ruleNoFolder'));
  const postUploadLabel = getPostUploadActionLabel(rule.postUploadAction, t);

  const statusBadge = ruleStatus?.active ? (
    <DesktopStatusBadge status="success" pulse>
      {t('ruleStatusActive')}
    </DesktopStatusBadge>
  ) : rule.enabled ? (
    <DesktopStatusBadge status="active">{t('ruleStatusEnabled')}</DesktopStatusBadge>
  ) : (
    <DesktopStatusBadge status="neutral">{t('ruleStatusDisabled')}</DesktopStatusBadge>
  );

  return (
    <div className="flex items-start gap-2 p-3 sm:gap-3 sm:p-4">
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        aria-controls={`watch-rule-panel-${rule.id}`}
        className="mt-0.5 flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left transition-colors hover:bg-surface-alt/60 focus:outline-none focus:ring-2 focus:ring-accent/25 dark:hover:bg-surface-dark/60 dark:focus:ring-accent-dark/25"
      >
        <span
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums ${
            ruleStatus?.active
              ? 'border-label-success-text/25 bg-label-success-bg text-label-success-text dark:border-label-success-text-dark/30 dark:bg-label-success-bg-dark dark:text-label-success-text-dark'
              : 'border-border/60 bg-surface-alt text-muted dark:border-border-dark/60 dark:bg-surface-dark dark:text-muted-dark'
          }`}
        >
          {ruleIndex + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-text dark:text-text-dark">
              {folderLabel}
            </span>
            {statusBadge}
          </span>
          {rule.watchPath ? (
            <span className="mt-0.5 block truncate font-mono text-xs text-muted dark:text-muted-dark">
              {rule.watchPath}
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-muted dark:text-muted-dark">
              {t('ruleSetupHint')}
            </span>
          )}
          {!expanded ? (
            <span className="mt-1.5 block text-xs text-muted dark:text-muted-dark">
              {postUploadLabel}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-muted transition-transform dark:text-muted-dark ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <DesktopToggle
          id={`desktop-watcher-enabled-${rule.id}`}
          checked={rule.enabled}
          disabled={saving || !hasCredential}
          busy={saving}
          onChange={onEnabledChange}
          label={t('enabledToggleLabel')}
          compact
        />
        {canRemove ? (
          <button
            type="button"
            onClick={onRemoveRule}
            disabled={saving || ruleStatus?.active}
            title={ruleStatus?.active ? t('removeRuleWhileActive') : undefined}
            className={`${desktopBtnDanger} px-2.5 py-1.5`}
          >
            <Trash className="size-3.5" />
            <span className="sr-only">{t('removeRule')}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
