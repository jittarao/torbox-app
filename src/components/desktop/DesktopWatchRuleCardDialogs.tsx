'use client';

import type { WatchRule } from '@/desktop/capabilities';
import DesktopConfirmDialog from '@/components/desktop/DesktopConfirmDialog';

type DesktopWatchRuleCardDialogsProps = {
  rule: WatchRule;
  showScanConfirm: boolean;
  showChangeFolderConfirm: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onCloseScanConfirm: () => void;
  onConfirmEnableWithScan: () => void;
  onCloseChangeFolderConfirm: () => void;
  onConfirmChangeFolderWhileRunning: () => void;
};

export default function DesktopWatchRuleCardDialogs({
  rule,
  showScanConfirm,
  showChangeFolderConfirm,
  t,
  onCloseScanConfirm,
  onConfirmEnableWithScan,
  onCloseChangeFolderConfirm,
  onConfirmChangeFolderWhileRunning,
}: DesktopWatchRuleCardDialogsProps) {
  return (
    <>
      <DesktopConfirmDialog
        open={showChangeFolderConfirm}
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
        open={showScanConfirm}
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
