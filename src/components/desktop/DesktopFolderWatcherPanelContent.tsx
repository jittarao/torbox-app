'use client';

import { useEffect, useRef, useState } from 'react';
import type { FolderWatcherConfig, WatchRule, WatcherStatus } from '@/desktop/capabilities';
import { Activity, Plus } from '@/components/icons';
import {
  desktopBtnPrimary,
  desktopBtnSecondary,
  DesktopInfoCallout,
  DesktopStatusBadge,
  desktopCardClass,
} from '@/components/desktop/DesktopUi';
import DesktopWatchRuleCard from '@/components/desktop/DesktopWatchRuleCard';
import Spinner from '@/components/shared/Spinner';

type DesktopFolderWatcherPanelContentProps = {
  embedded: boolean;
  hasCredential: boolean;
  draft: FolderWatcherConfig;
  watcherStatus: WatcherStatus | null;
  isRunning: boolean;
  saving: boolean;
  stopping: boolean;
  canAddRule: boolean;
  maxRules: number;
  pickingWatchRuleId: string | null;
  pickingMoveRuleId: string | null;
  scanConfirmRuleId: string | null;
  changeFolderRuleId: string | null;
  t: (key: string, values?: Record<string, string | number>) => string;
  onAddRule: () => void;
  onRemoveRule: (ruleId: string) => void;
  onUpdateRule: (ruleId: string, partial: Partial<WatchRule>) => void;
  onPickWatchFolder: (ruleId: string) => void;
  onPickMoveFolder: (ruleId: string) => void;
  onEnabledChange: (ruleId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onStart: () => void;
  onStop: () => void;
  onCloseScanConfirm: () => void;
  onConfirmEnableWithScan: () => void;
  onCloseChangeFolderConfirm: () => void;
  onConfirmChangeFolderWhileRunning: () => void;
};

export default function DesktopFolderWatcherPanelContent({
  embedded,
  hasCredential,
  draft,
  watcherStatus,
  isRunning,
  saving,
  stopping,
  canAddRule,
  maxRules,
  pickingWatchRuleId,
  pickingMoveRuleId,
  scanConfirmRuleId,
  changeFolderRuleId,
  t,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onPickWatchFolder,
  onPickMoveFolder,
  onEnabledChange,
  onStart,
  onStop,
  onCloseScanConfirm,
  onConfirmEnableWithScan,
  onCloseChangeFolderConfirm,
  onConfirmChangeFolderWhileRunning,
}: DesktopFolderWatcherPanelContentProps) {
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(() => new Set());
  const previousRuleCountRef = useRef(draft.rules.length);
  const initializedExpansionRef = useRef(false);

  const hasEnabledRule = draft.rules.some((rule) => rule.enabled && rule.watchPath);
  const enabledRuleCount = draft.rules.filter((rule) => rule.enabled).length;
  const activeRuleCount = watcherStatus?.rules.filter((rule) => rule.active).length ?? 0;

  useEffect(() => {
    if (draft.rules.length === 0) {
      setExpandedRuleIds(new Set());
      previousRuleCountRef.current = 0;
      initializedExpansionRef.current = false;
      return;
    }

    if (draft.rules.length > previousRuleCountRef.current) {
      const newestRule = draft.rules[draft.rules.length - 1];
      if (newestRule) {
        setExpandedRuleIds((current) => new Set(current).add(newestRule.id));
      }
    } else if (!initializedExpansionRef.current && draft.rules.length === 1) {
      setExpandedRuleIds(new Set([draft.rules[0].id]));
      initializedExpansionRef.current = true;
    }

    previousRuleCountRef.current = draft.rules.length;
  }, [draft.rules]);

  const toggleRuleExpanded = (ruleId: string) => {
    setExpandedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <section
        className={`${desktopCardClass} overflow-hidden ${
          isRunning ? 'border-label-success-text/25 dark:border-label-success-text-dark/30' : ''
        }`}
      >
        <div
          className={`border-b border-border/50 px-4 py-4 sm:px-5 ${
            isRunning
              ? 'bg-label-success-bg/35 dark:bg-label-success-bg-dark/20'
              : 'bg-surface-alt/40 dark:bg-surface-dark/40'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Activity
                  className={`size-4 shrink-0 ${
                    isRunning
                      ? 'text-label-success-text dark:text-label-success-text-dark'
                      : 'text-muted dark:text-muted-dark'
                  }`}
                />
                <h3 className="text-sm font-semibold text-text dark:text-text-dark">
                  {isRunning ? t('statusRunning') : t('statusStopped')}
                </h3>
                {isRunning ? (
                  <DesktopStatusBadge status="success" pulse>
                    {t('activeRulesCount', { count: activeRuleCount })}
                  </DesktopStatusBadge>
                ) : enabledRuleCount > 0 ? (
                  <DesktopStatusBadge status="active">
                    {t('enabledRulesCount', { count: enabledRuleCount })}
                  </DesktopStatusBadge>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark">
                {isRunning ? t('statusRunningHint') : t('statusStoppedHint')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={onStop}
                  disabled={stopping}
                  className={desktopBtnPrimary}
                >
                  {stopping ? <Spinner className="size-4" /> : null}
                  {t('stopWatcher')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={!hasEnabledRule || !hasCredential || saving}
                  className={desktopBtnPrimary}
                >
                  {t('startWatcher')}
                </button>
              )}
            </div>
          </div>
        </div>

        <dl className="grid gap-px bg-border/40 sm:grid-cols-2 dark:bg-border-dark/40">
          <div className="bg-white px-4 py-3 dark:bg-surface-alt-dark sm:px-5">
            <dt className="text-xs text-muted dark:text-muted-dark">{t('queueDepth')}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-text dark:text-text-dark">
              {watcherStatus?.queueDepth ?? 0}
            </dd>
          </div>
          <div className="bg-white px-4 py-3 dark:bg-surface-alt-dark sm:px-5">
            <dt className="text-xs text-muted dark:text-muted-dark">{t('uploadsToday')}</dt>
            <dd className="mt-0.5 text-xl font-semibold tabular-nums text-text dark:text-text-dark">
              {watcherStatus?.uploadsToday ?? 0}
            </dd>
          </div>
        </dl>

        {watcherStatus?.lastError ? (
          <div className="border-t border-border/50 px-4 py-3 dark:border-border-dark/50 sm:px-5">
            <DesktopInfoCallout variant="warning">{watcherStatus.lastError}</DesktopInfoCallout>
          </div>
        ) : null}
      </section>

      {!hasCredential ? (
        <DesktopInfoCallout variant="warning">{t('credentialRequired')}</DesktopInfoCallout>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text dark:text-text-dark">
              {t('rulesTitle')}
            </h3>
            <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">
              {t('rulesDescription', { maxRules })}
            </p>
          </div>
          <button
            type="button"
            onClick={onAddRule}
            disabled={!canAddRule || saving}
            className={desktopBtnSecondary}
          >
            <Plus className="size-4" />
            {t('addRule')}
          </button>
        </div>

        {draft.rules.length === 0 ? (
          <div className={`${desktopCardClass} flex flex-col items-center px-6 py-10 text-center`}>
            <p className="text-sm font-medium text-text dark:text-text-dark">
              {t('emptyStateTitle')}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted dark:text-muted-dark">
              {t('emptyStateDescription')}
            </p>
            <button
              type="button"
              onClick={onAddRule}
              disabled={!canAddRule || saving}
              className={`${desktopBtnPrimary} mt-5`}
            >
              <Plus className="size-4" />
              {t('addRule')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {draft.rules.map((rule, index) => (
              <DesktopWatchRuleCard
                key={rule.id}
                rule={rule}
                ruleIndex={index}
                expanded={expandedRuleIds.has(rule.id)}
                ruleStatus={
                  watcherStatus?.rules.find((status) => status.ruleId === rule.id) ?? null
                }
                canRemove
                hasCredential={hasCredential}
                saving={saving}
                pickingWatchFolder={pickingWatchRuleId === rule.id}
                pickingMoveFolder={pickingMoveRuleId === rule.id}
                showScanConfirm={scanConfirmRuleId === rule.id}
                showChangeFolderConfirm={changeFolderRuleId === rule.id}
                t={t}
                onToggleExpanded={() => toggleRuleExpanded(rule.id)}
                onUpdateRule={(partial) => onUpdateRule(rule.id, partial)}
                onRemoveRule={() => onRemoveRule(rule.id)}
                onPickWatchFolder={() => onPickWatchFolder(rule.id)}
                onPickMoveFolder={() => onPickMoveFolder(rule.id)}
                onEnabledChange={(event) => onEnabledChange(rule.id, event)}
                onCloseScanConfirm={onCloseScanConfirm}
                onConfirmEnableWithScan={onConfirmEnableWithScan}
                onCloseChangeFolderConfirm={onCloseChangeFolderConfirm}
                onConfirmChangeFolderWhileRunning={onConfirmChangeFolderWhileRunning}
              />
            ))}
          </div>
        )}

        {!canAddRule && draft.rules.length > 0 ? (
          <p className="text-xs text-muted dark:text-muted-dark">
            {t('maxRulesReached', { maxRules })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
