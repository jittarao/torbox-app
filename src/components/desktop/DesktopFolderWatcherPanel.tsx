'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import type { FolderWatcherConfig, PostUploadAction } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import {
  desktopBtnPrimary,
  desktopBtnSecondary,
  DesktopActionBar,
  DesktopInfoCallout,
  desktopOptionBase,
  desktopOptionDefault,
  desktopOptionSelected,
  DesktopPathDisplay,
  DesktopSubsection,
  DesktopToggle,
} from '@/components/desktop/DesktopUi';
import { Activity } from '@/components/icons';

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
  instanceUrl,
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

  const formatActivityResult = (result: string) => {
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
  };

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseWatcher || !canPickFolder || !canUpload) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const updateDraft = (partial: Partial<FolderWatcherConfig>) => {
    setDraft((current) => ({ ...current, ...partial }));
  };

  const pickWatchFolder = async () => {
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
  };

  const handlePickWatchFolder = async () => {
    if (watcherStatus?.running) {
      setShowChangeFolderConfirm(true);
      return;
    }
    await pickWatchFolder();
  };

  const confirmChangeFolderWhileRunning = async () => {
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
  };

  const handlePickMoveFolder = async () => {
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
  };

  const handleSave = async (nextDraft: FolderWatcherConfig) => {
    setSaving(true);
    try {
      const ok = await saveWatcherConfig(nextDraft);
      notify(ok ? t('saveSuccess') : t('saveFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEnabledChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const confirmEnableWithScan = async () => {
    const nextDraft = { ...draft, enabled: true };
    setShowScanConfirm(false);
    setDraft(nextDraft);
    await handleSave(nextDraft);
  };

  const handleStart = async () => {
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
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const ok = await stopWatcher();
      notify(ok ? t('stopSuccess') : t('stopFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('stopFailed'), 'error');
    } finally {
      setStopping(false);
    }
  };

  const isRunning = Boolean(watcherStatus?.running);

  const content = (
    <div className="space-y-4">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <div
        className={`rounded-xl border px-4 py-4 sm:px-5 ${
          isRunning
            ? 'border-label-success-text/25 bg-label-success-bg/40 dark:border-label-success-text-dark/30 dark:bg-label-success-bg-dark/25'
            : 'border-border/60 bg-surface-alt/40 dark:border-border-dark/60 dark:bg-surface-dark/40'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity
              className={`size-4 shrink-0 ${isRunning ? 'text-label-success-text dark:text-label-success-text-dark' : 'text-muted dark:text-muted-dark'}`}
            />
            <p className="text-sm font-semibold text-text dark:text-text-dark">
              {isRunning ? t('statusRunning') : t('statusStopped')}
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark">
            {isRunning ? t('statusRunningHint') : t('statusStoppedHint')}
          </p>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/40 bg-white/80 px-3 py-2.5 dark:border-border-dark/40 dark:bg-surface-alt-dark/80">
            <dt className="text-xs text-muted dark:text-muted-dark">{t('queueDepth')}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-text dark:text-text-dark">
              {watcherStatus?.queueDepth ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-border/40 bg-white/80 px-3 py-2.5 dark:border-border-dark/40 dark:bg-surface-alt-dark/80">
            <dt className="text-xs text-muted dark:text-muted-dark">{t('uploadsToday')}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-text dark:text-text-dark">
              {watcherStatus?.uploadsToday ?? 0}
            </dd>
          </div>
        </dl>

        {watcherStatus?.lastError ? (
          <DesktopInfoCallout variant="warning" className="mt-4">
            {watcherStatus.lastError}
          </DesktopInfoCallout>
        ) : null}
      </div>

      {!hasCredential ? (
        <DesktopInfoCallout variant="warning">{t('credentialRequired')}</DesktopInfoCallout>
      ) : null}

      {hasUnsavedChanges ? (
        <DesktopInfoCallout variant="warning">{t('unsavedChanges')}</DesktopInfoCallout>
      ) : null}

      <DesktopSubsection
        title={t('subsections.setup')}
        description={t('subsections.setupDescription')}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePickWatchFolder}
              disabled={pickingWatchFolder}
              className={desktopBtnSecondary}
            >
              {pickingWatchFolder ? <Spinner className="size-4" /> : null}
              {t('chooseFolder')}
            </button>
            {draft.watchPath ? (
              <button
                type="button"
                onClick={() => updateDraft({ watchPath: null })}
                className={desktopBtnSecondary}
              >
                {t('clearFolder')}
              </button>
            ) : null}
          </div>
          <DesktopPathDisplay value={draft.watchPath} emptyLabel={t('noFolderSelected')} />
        </div>

        <div className="mt-4 border-t border-border/40 pt-4 dark:border-border-dark/40">
          <DesktopToggle
            id="desktop-watcher-enabled"
            checked={draft.enabled}
            disabled={saving || !hasCredential}
            busy={saving}
            onChange={handleEnabledChange}
            label={t('enabledToggleLabel')}
            description={t('enabledToggleHelp')}
          />
        </div>
      </DesktopSubsection>

      <DesktopSubsection
        title={t('subsections.behavior')}
        description={t('subsections.behaviorDescription')}
      >
        <fieldset className="space-y-3">
          <legend className="sr-only">{t('postUploadAction')}</legend>
          {(['delete', 'moveToUploaded', 'moveToCustom'] as PostUploadAction[]).map((action) => (
            <label
              key={action}
              className={`${desktopOptionBase} ${
                draft.postUploadAction === action ? desktopOptionSelected : desktopOptionDefault
              }`}
            >
              <input
                type="radio"
                name="postUploadAction"
                checked={draft.postUploadAction === action}
                onChange={() => updateDraft({ postUploadAction: action })}
                className="mt-1 accent-accent dark:accent-accent-dark"
              />
              <span className="text-sm">
                {action === 'delete' && t('actionDelete')}
                {action === 'moveToUploaded' && t('actionMoveToUploaded')}
                {action === 'moveToCustom' && t('actionMoveToCustom')}
              </span>
            </label>
          ))}
          {draft.postUploadAction === 'moveToUploaded' && uploadedPreview ? (
            <DesktopPathDisplay value={uploadedPreview} emptyLabel={t('noFolderSelected')} />
          ) : null}
          {draft.postUploadAction === 'moveToCustom' ? (
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handlePickMoveFolder}
                disabled={pickingMoveFolder}
                className={desktopBtnSecondary}
              >
                {pickingMoveFolder ? <Spinner className="size-4" /> : null}
                {t('chooseMoveFolder')}
              </button>
              <DesktopPathDisplay value={draft.customMovePath} emptyLabel={t('noFolderSelected')} />
            </div>
          ) : null}
        </fieldset>
      </DesktopSubsection>

      <DesktopSubsection
        title={t('subsections.options')}
        description={t('subsections.optionsDescription')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white px-3 py-2.5 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
            <input
              type="checkbox"
              checked={draft.torrentOptions.seed === 1}
              onChange={(e) =>
                updateDraft({
                  torrentOptions: {
                    ...draft.torrentOptions,
                    seed: e.target.checked ? 1 : 0,
                  },
                })
              }
            />
            {t('optionSeed')}
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white px-3 py-2.5 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
            <input
              type="checkbox"
              checked={draft.torrentOptions.allowZip}
              onChange={(e) =>
                updateDraft({
                  torrentOptions: {
                    ...draft.torrentOptions,
                    allowZip: e.target.checked,
                  },
                })
              }
            />
            {t('optionAllowZip')}
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white px-3 py-2.5 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
            <input
              type="checkbox"
              checked={draft.torrentOptions.asQueued}
              onChange={(e) =>
                updateDraft({
                  torrentOptions: {
                    ...draft.torrentOptions,
                    asQueued: e.target.checked,
                  },
                })
              }
            />
            {t('optionAsQueued')}
          </label>
          <label className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white px-3 py-2.5 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
            <input
              type="checkbox"
              checked={draft.torrentOptions.addOnlyIfCached}
              onChange={(e) =>
                updateDraft({
                  torrentOptions: {
                    ...draft.torrentOptions,
                    addOnlyIfCached: e.target.checked,
                  },
                })
              }
            />
            {t('optionAddOnlyIfCached')}
          </label>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-border/50 bg-white px-3 py-3 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
          <input
            type="checkbox"
            checked={draft.scanExistingOnEnable}
            onChange={(e) => updateDraft({ scanExistingOnEnable: e.target.checked })}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{t('scanExisting')}</span>
            <span className="mt-0.5 block text-xs text-muted dark:text-muted-dark">
              {t('scanExistingHelp')}
            </span>
          </span>
        </label>

        <label className="mt-4 block rounded-lg border border-border/50 bg-white px-3 py-3 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
          <span className="font-medium">{t('stableFileMsLabel')}</span>
          <input
            type="number"
            min={500}
            step={100}
            value={draft.stableFileMs}
            onChange={(e) =>
              updateDraft({
                stableFileMs: Math.max(500, Number.parseInt(e.target.value, 10) || 500),
              })
            }
            className="mt-2 w-full rounded-md border border-border/60 bg-white px-3 py-2 text-sm dark:border-border-dark/60 dark:bg-surface-alt-dark"
          />
          <span className="mt-1 block text-xs text-muted dark:text-muted-dark">
            {t('stableFileMsHelp')}
          </span>
        </label>
      </DesktopSubsection>

      <DesktopActionBar hint={t('actionsHelp')}>
        <button
          type="button"
          onClick={() => handleSave(draft)}
          disabled={saving}
          className={desktopBtnSecondary}
        >
          {saving ? <Spinner className="size-4" /> : null}
          {t('saveSettings')}
        </button>
        {isRunning ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={stopping}
            className={desktopBtnPrimary}
          >
            {stopping ? <Spinner className="size-4" /> : null}
            {t('stopWatcher')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={!draft.watchPath || !hasCredential || saving || hasUnsavedChanges}
            className={desktopBtnPrimary}
          >
            {t('startWatcher')}
          </button>
        )}
      </DesktopActionBar>

      <DesktopSubsection title={t('recentActivity')}>
        {watcherStatus?.activity?.length ? (
          <div className="space-y-2">
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50 dark:divide-border-dark/50 dark:border-border-dark/50">
              {watcherStatus.activity.map((entry, index) => (
                <li
                  key={`${entry.timestamp}-${entry.filename}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-xs dark:bg-surface-dark"
                >
                  <span className="min-w-0 font-mono text-text dark:text-text-dark">
                    {entry.filename}
                  </span>
                  <span className="text-muted dark:text-muted-dark">
                    {formatActivityResult(entry.result)}
                    {entry.detail ? ` — ${entry.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => router.push('/uploads')}
              className="text-xs font-medium text-accent hover:underline dark:text-accent-dark"
            >
              {t('openUploadsPage')}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted dark:text-muted-dark">{t('noActivity')}</p>
        )}
      </DesktopSubsection>

      {showChangeFolderConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
          <div
            className="w-full max-w-md rounded-xl border border-border/60 bg-white p-6 shadow-2xl dark:border-border-dark/60 dark:bg-surface-alt-dark"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-folder-confirm-title"
          >
            <h4
              id="change-folder-confirm-title"
              className="text-lg font-semibold text-text dark:text-text-dark"
            >
              {t('changeFolderWhileRunningTitle')}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-muted dark:text-muted-dark">
              {t('changeFolderWhileRunningConfirm')}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangeFolderConfirm(false)}
                className={desktopBtnSecondary}
              >
                {t('scanConfirmCancel')}
              </button>
              <button
                type="button"
                onClick={confirmChangeFolderWhileRunning}
                className={desktopBtnPrimary}
              >
                {t('changeFolderWhileRunningProceed')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showScanConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
          <div
            className="w-full max-w-md rounded-xl border border-border/60 bg-white p-6 shadow-2xl dark:border-border-dark/60 dark:bg-surface-alt-dark"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-confirm-title"
          >
            <h4
              id="scan-confirm-title"
              className="text-lg font-semibold text-text dark:text-text-dark"
            >
              {t('scanConfirmTitle')}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-muted dark:text-muted-dark">
              {t('scanConfirmBody')}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowScanConfirm(false)}
                className={desktopBtnSecondary}
              >
                {t('scanConfirmCancel')}
              </button>
              <button type="button" onClick={confirmEnableWithScan} className={desktopBtnPrimary}>
                {t('scanConfirmProceed')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
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
