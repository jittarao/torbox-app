'use client';

import { DesktopInfoCallout } from '@/components/desktop/DesktopUi';
import DesktopFolderWatcherPanelContent from '@/components/desktop/DesktopFolderWatcherPanelContent';
import { useDesktopFolderWatcherPanel } from '@/components/desktop/useDesktopFolderWatcherPanel';

type DesktopFolderWatcherPanelProps = {
  hasCredential: boolean;
  instanceUrl?: string | null;
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

export default function DesktopFolderWatcherPanel({
  hasCredential,
  instanceUrl: _instanceUrl,
  setToast,
  embedded = false,
}: DesktopFolderWatcherPanelProps) {
  const panel = useDesktopFolderWatcherPanel({ hasCredential, setToast });

  if (
    !panel.canUseWatcher ||
    !panel.canPickFolder ||
    !panel.canUpload ||
    !panel.supportsMultiRule
  ) {
    return <DesktopInfoCallout variant="warning">{panel.t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  return (
    <DesktopFolderWatcherPanelContent
      embedded={embedded}
      hasCredential={hasCredential}
      draft={panel.draft}
      watcherStatus={panel.watcherStatus}
      isRunning={panel.isRunning}
      saving={panel.saving}
      stopping={panel.stopping}
      canAddRule={panel.canAddRule}
      maxRules={panel.maxRules}
      pickingWatchRuleId={panel.pickingWatchRuleId}
      pickingMoveRuleId={panel.pickingMoveRuleId}
      scanConfirmRuleId={panel.scanConfirmRuleId}
      changeFolderRuleId={panel.changeFolderRuleId}
      expandedRuleIds={panel.expandedRuleIds}
      onToggleRuleExpanded={panel.toggleRuleExpanded}
      t={panel.t}
      onAddRule={panel.addRule}
      onRemoveRule={panel.removeRule}
      onUpdateRule={panel.updateRule}
      onPickWatchFolder={panel.handlePickWatchFolder}
      onPickMoveFolder={panel.handlePickMoveFolder}
      onEnabledChange={panel.handleEnabledChange}
      onStart={panel.handleStart}
      onStop={panel.handleStop}
      onCloseScanConfirm={() => panel.setScanConfirmRuleId(null)}
      onConfirmEnableWithScan={panel.confirmEnableWithScan}
      onCloseChangeFolderConfirm={() => panel.setChangeFolderRuleId(null)}
      onConfirmChangeFolderWhileRunning={panel.confirmChangeFolderWhileRunning}
    />
  );
}
