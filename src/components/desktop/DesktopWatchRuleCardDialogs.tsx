'use client';

import type { WatchRule } from '@/desktop/capabilities';
import DesktopConfirmDialog from '@/components/desktop/DesktopConfirmDialog';

type WatchRuleDialog = 'scan' | 'changeFolder' | null;

type DesktopWatchRuleCardDialogsProps = {
  rule: WatchRule;
  activeDialog: WatchRuleDialog;
  t: (key: string, values?: Record<string, string | number>) => string;
  onCloseScanConfirm: () => void;
  onConfirmEnableWithScan: () => void;
  onCloseChangeFolderConfirm: () => void;
  onConfirmChangeFolderWhileRunning: () => void;
};

export default function DesktopWatchRuleCardDialogs({
  rule,
  activeDialog,
  t,
  onCloseScanConfirm,
  onConfirmEnableWithScan,
  onCloseChangeFolderConfirm,
  onConfirmChangeFolderWhileRunning,
}: DesktopWatchRuleCardDialogsProps) {
  return (
    <>
      <DesktopConfirmDialog
        open={activeDialog === 'changeFolder'}
        onClose={onCloseChangeFolderConfirm}
        titleId={`change-folder-confirm-title-${rule.id}`}
        title={t('changeFolderWhileRunningTitle')}
        cancelLabel={t('scanConfirmCancel')}
        confirmLabel={t('changeFolderWhileRunningProceed')}
        onConfirm={onConfirmChangeFolderWhileRunning}
      >
        {t('changeFolderWhileRunningConfirm')}
      </DesktopConfirmDialog>

      <DesktopConfirmDialog
        open={activeDialog === 'scan'}
        onClose={onCloseScanConfirm}
        titleId={`scan-confirm-title-${rule.id}`}
        title={t('scanConfirmTitle')}
        cancelLabel={t('scanConfirmCancel')}
        confirmLabel={t('scanConfirmProceed')}
        onConfirm={onConfirmEnableWithScan}
      >
        {t('scanConfirmBody')}
      </DesktopConfirmDialog>
    </>
  );
}
