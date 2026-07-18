'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import type { FolderWatcherConfig } from '@/desktop/capabilities';
import { DesktopInfoCallout } from '@/components/desktop/DesktopUi';
import DesktopFolderWatcherPanelContent from '@/components/desktop/DesktopFolderWatcherPanelContent';

const DEFAULT_WATCHER_CONFIG: FolderWatcherConfig = {
  enabled: false,
  watchPath: null,
  postUploadAction: 'moveToUploaded',
  customMovePath: null,
  torrentOptions: {
    seed: 1,
    allowZip: true,
    asQueued: false,
    addOnlyIfCached: false,
  },
  scanExistingOnEnable: false,
  stableFileMs: 2000,
};

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
  const t = useTranslations('Desktop.folderWatcher');
  const router = useRouter();
  const { capabilities } = useDesktopCapabilities();
  const watcherConfig = useDesktopStore((state) => state.watcherConfig);
  const watcherStatus = useDesktopStore((state) => state.watcherStatus);
  const pickFolder = useDesktopStore((state) => state.pickFolder);
  const pickMoveDestinationFolder = useDesktopStore((state) => state.pickMoveDestinationFolder);
  const saveWatcherConfig = useDesktopStore((state) => state.saveWatcherConfig);
  const startWatcher = useDesktopStore((state) => state.startWatcher);
  const stopWatcher = useDesktopStore((state) => state.stopWatcher);

  const [draft, setDraft] = useState<FolderWatcherConfig>(DEFAULT_WATCHER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [pickingWatchFolder, setPickingWatchFolder] = useState(false);
  const [pickingMoveFolder, setPickingMoveFolder] = useState(false);
  const [showScanConfirm, setShowScanConfirm] = useState(false);
  const [showChangeFolderConfirm, setShowChangeFolderConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);

  const canUseWatcher = hasFeature(capabilities, 'folderWatcher');
  const canPickFolder = hasFeature(capabilities, 'folderPicker');
  const canUpload = hasFeature(capabilities, 'backgroundUploads');

  useEffect(() => {
    if (watcherConfig) {
      setDraft(watcherConfig);
    }
  }, [watcherConfig]);

  const uploadedPreview = useMemo(() => {
    if (!draft.watchPath) {
      return null;
    }
    return `${draft.watchPath.replace(/\/$/, '')}/uploaded`;
  }, [draft.watchPath]);

  const hasUnsavedChanges = useMemo(() => {
    if (!watcherConfig) {
      return false;
    }
    return JSON.stringify(draft) !== JSON.stringify(watcherConfig);
  }, [draft, watcherConfig]);

  const formatActivityResult = useCallback(
    (result: string) => {
      switch (result) {
        case 'success':
          return t('activitySuccess');
        case 'failed':
          return t('activityFailed');
        case 'retry':
          return t('activityRetry');
        case 'uploaded_move_failed':
          return t('activityMoveFailed');
        default:
          return result;
      }
    },
    [t]
  );

  const notify = useCallback(
    (message: string, type: 'success' | 'error') => {
      setToast?.({ message, type });
    },
    [setToast]
  );

  const updateDraft = useCallback((partial: Partial<FolderWatcherConfig>) => {
    setDraft((current) => ({ ...current, ...partial }));
  }, []);

  const handleSave = useCallback(
    async (nextDraft: FolderWatcherConfig) => {
      setSaving(true);
      try {
        const ok = await saveWatcherConfig(nextDraft);
        notify(ok ? t('saveSuccess') : t('saveFailed'), ok ? 'success' : 'error');
      } catch (error) {
        notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
      } finally {
        setSaving(false);
      }
    },
    [notify, saveWatcherConfig, t]
  );

  const pickWatchFolder = useCallback(async () => {
    setPickingWatchFolder(true);
    try {
      const path = await pickFolder();
      if (path) {
        const nextDraft = { ...draft, watchPath: path };
        setDraft(nextDraft);
        await handleSave(nextDraft);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('pickFolderFailed'), 'error');
    } finally {
      setPickingWatchFolder(false);
    }
  }, [draft, handleSave, notify, pickFolder, t]);

  const handlePickWatchFolder = useCallback(async () => {
    if (watcherStatus?.running) {
      setShowChangeFolderConfirm(true);
      return;
    }
    await pickWatchFolder();
  }, [pickWatchFolder, watcherStatus?.running]);

  const confirmChangeFolderWhileRunning = useCallback(async () => {
    setShowChangeFolderConfirm(false);
    setSaving(true);
    try {
      await stopWatcher();
      const nextDraft = { ...draft, enabled: false };
      setDraft(nextDraft);
      const ok = await saveWatcherConfig(nextDraft);
      if (!ok) {
        notify(t('saveFailed'), 'error');
        return;
      }
      await pickWatchFolder();
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [draft, notify, pickWatchFolder, saveWatcherConfig, stopWatcher, t]);

  const handlePickMoveFolder = useCallback(async () => {
    setPickingMoveFolder(true);
    try {
      const path = await pickMoveDestinationFolder();
      if (path) {
        updateDraft({ customMovePath: path, postUploadAction: 'moveToCustom' });
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('pickFolderFailed'), 'error');
    } finally {
      setPickingMoveFolder(false);
    }
  }, [notify, pickMoveDestinationFolder, t, updateDraft]);

  const handleEnabledChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const enabling = event.target.checked;

      if (enabling) {
        if (!hasCredential) {
          notify(t('credentialRequired'), 'error');
          return;
        }
        if (!draft.watchPath) {
          notify(t('watchFolderRequired'), 'error');
          return;
        }
        if (draft.postUploadAction === 'moveToCustom' && !draft.customMovePath) {
          notify(t('customMovePathRequired'), 'error');
          return;
        }
      }

      const nextDraft = { ...draft, enabled: enabling };

      if (enabling && nextDraft.scanExistingOnEnable) {
        setShowScanConfirm(true);
        return;
      }

      setDraft(nextDraft);
      await handleSave(nextDraft);
    },
    [draft, handleSave, hasCredential, notify, t]
  );

  const confirmEnableWithScan = useCallback(async () => {
    const nextDraft = { ...draft, enabled: true };
    setShowScanConfirm(false);
    setDraft(nextDraft);
    await handleSave(nextDraft);
  }, [draft, handleSave]);

  const handleStart = useCallback(async () => {
    if (!hasCredential) {
      notify(t('credentialRequired'), 'error');
      return;
    }
    try {
      const scanExisting = draft.scanExistingOnEnable;
      const ok = await startWatcher(scanExisting);
      notify(ok ? t('startSuccess') : t('startFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('startFailed'), 'error');
    }
  }, [draft.scanExistingOnEnable, hasCredential, notify, startWatcher, t]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      const ok = await stopWatcher();
      notify(ok ? t('stopSuccess') : t('stopFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('stopFailed'), 'error');
    } finally {
      setStopping(false);
    }
  }, [notify, stopWatcher, t]);

  if (!canUseWatcher || !canPickFolder || !canUpload) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const isRunning = Boolean(watcherStatus?.running);

  const content = (
    <DesktopFolderWatcherPanelContent
      embedded={embedded}
      hasCredential={hasCredential}
      draft={draft}
      watcherStatus={watcherStatus}
      uploadedPreview={uploadedPreview}
      hasUnsavedChanges={hasUnsavedChanges}
      isRunning={isRunning}
      saving={saving}
      stopping={stopping}
      pickingWatchFolder={pickingWatchFolder}
      pickingMoveFolder={pickingMoveFolder}
      showScanConfirm={showScanConfirm}
      showChangeFolderConfirm={showChangeFolderConfirm}
      t={t}
      formatActivityResult={formatActivityResult}
      updateDraft={updateDraft}
      onPickWatchFolder={handlePickWatchFolder}
      onPickMoveFolder={handlePickMoveFolder}
      onEnabledChange={handleEnabledChange}
      onSave={handleSave}
      onStart={handleStart}
      onStop={handleStop}
      onOpenUploads={() => router.push('/uploads')}
      onCloseScanConfirm={() => setShowScanConfirm(false)}
      onConfirmEnableWithScan={confirmEnableWithScan}
      onCloseChangeFolderConfirm={() => setShowChangeFolderConfirm(false)}
      onConfirmChangeFolderWhileRunning={confirmChangeFolderWhileRunning}
    />
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark">
        <div className="space-y-4 p-4 sm:p-5">{content}</div>
      </div>
    );
  }

  return content;
}
