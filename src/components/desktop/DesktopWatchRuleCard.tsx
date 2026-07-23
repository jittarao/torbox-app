'use client';

import type { WatchRule, WatchRuleStatus } from '@/desktop/capabilities';
import { DesktopInfoCallout } from '@/components/desktop/DesktopUi';
import DesktopWatchRuleCardHeader from './DesktopWatchRuleCardHeader';
import DesktopWatchRuleCardExpandedPanel from './DesktopWatchRuleCardExpandedPanel';
import DesktopWatchRuleCardDialogs from './DesktopWatchRuleCardDialogs';

type DesktopWatchRuleCardProps = {
  rule: WatchRule;
  ruleStatus: WatchRuleStatus | null;
  ruleIndex: number;
  expanded: boolean;
  canRemove: boolean;
  hasCredential: boolean;
  saving: boolean;
  pickingWatchFolder: boolean;
  pickingMoveFolder: boolean;
  showScanConfirm: boolean;
  showChangeFolderConfirm: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onToggleExpanded: () => void;
  onUpdateRule: (partial: Partial<WatchRule>) => void | Promise<void>;
  onRemoveRule: () => void;
  onPickWatchFolder: () => void;
  onPickMoveFolder: () => void;
  onEnabledChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCloseScanConfirm: () => void;
  onConfirmEnableWithScan: () => void;
  onCloseChangeFolderConfirm: () => void;
  onConfirmChangeFolderWhileRunning: () => void;
};

export default function DesktopWatchRuleCard({
  rule,
  ruleStatus,
  ruleIndex,
  expanded,
  canRemove,
  hasCredential,
  saving,
  pickingWatchFolder,
  pickingMoveFolder,
  showScanConfirm,
  showChangeFolderConfirm,
  t,
  onToggleExpanded,
  onUpdateRule,
  onRemoveRule,
  onPickWatchFolder,
  onPickMoveFolder,
  onEnabledChange,
  onCloseScanConfirm,
  onConfirmEnableWithScan,
  onCloseChangeFolderConfirm,
  onConfirmChangeFolderWhileRunning,
}: DesktopWatchRuleCardProps) {
  return (
    <article
      className={`overflow-hidden rounded-xl border transition-colors ${
        ruleStatus?.active
          ? 'border-label-success-text/30 bg-label-success-bg/20 dark:border-label-success-text-dark/35 dark:bg-label-success-bg-dark/15'
          : 'border-border/60 bg-white dark:border-border-dark/60 dark:bg-surface-alt-dark'
      }`}
    >
      <DesktopWatchRuleCardHeader
        rule={rule}
        ruleStatus={ruleStatus}
        ruleIndex={ruleIndex}
        expanded={expanded}
        canRemove={canRemove}
        hasCredential={hasCredential}
        saving={saving}
        t={t}
        onToggleExpanded={onToggleExpanded}
        onRemoveRule={onRemoveRule}
        onEnabledChange={onEnabledChange}
      />

      {ruleStatus?.lastError ? (
        <div className="px-3 pb-3 sm:px-4">
          <DesktopInfoCallout variant="warning">{ruleStatus.lastError}</DesktopInfoCallout>
        </div>
      ) : null}

      {expanded ? (
        <DesktopWatchRuleCardExpandedPanel
          rule={rule}
          pickingWatchFolder={pickingWatchFolder}
          pickingMoveFolder={pickingMoveFolder}
          t={t}
          onUpdateRule={onUpdateRule}
          onPickWatchFolder={onPickWatchFolder}
          onPickMoveFolder={onPickMoveFolder}
        />
      ) : null}

      <DesktopWatchRuleCardDialogs
        rule={rule}
        showScanConfirm={showScanConfirm}
        showChangeFolderConfirm={showChangeFolderConfirm}
        t={t}
        onCloseScanConfirm={onCloseScanConfirm}
        onConfirmEnableWithScan={onConfirmEnableWithScan}
        onCloseChangeFolderConfirm={onCloseChangeFolderConfirm}
        onConfirmChangeFolderWhileRunning={onConfirmChangeFolderWhileRunning}
      />
    </article>
  );
}
