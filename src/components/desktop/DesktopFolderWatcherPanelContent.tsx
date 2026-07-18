'use client';

import type { FolderWatcherConfig, PostUploadAction, WatcherStatus } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import DesktopConfirmDialog from '@/components/desktop/DesktopConfirmDialog';
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

type DesktopFolderWatcherPanelContentProps = {
  embedded: boolean;
  hasCredential: boolean;
  draft: FolderWatcherConfig;
  watcherStatus: WatcherStatus | null;
  uploadedPreview: string | null;
  hasUnsavedChanges: boolean;
  isRunning: boolean;
  saving: boolean;
  stopping: boolean;
  pickingWatchFolder: boolean;
  pickingMoveFolder: boolean;
  showScanConfirm: boolean;
  showChangeFolderConfirm: boolean;
  t: (key: string) => string;
  formatActivityResult: (result: string) => string;
  updateDraft: (partial: Partial<FolderWatcherConfig>) => void;
  onPickWatchFolder: () => void;
  onPickMoveFolder: () => void;
  onEnabledChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: (nextDraft: FolderWatcherConfig) => void;
  onStart: () => void;
  onStop: () => void;
  onOpenUploads: () => void;
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
  uploadedPreview,
  hasUnsavedChanges,
  isRunning,
  saving,
  stopping,
  pickingWatchFolder,
  pickingMoveFolder,
  showScanConfirm,
  showChangeFolderConfirm,
  t,
  formatActivityResult,
  updateDraft,
  onPickWatchFolder,
  onPickMoveFolder,
  onEnabledChange,
  onSave,
  onStart,
  onStop,
  onOpenUploads,
  onCloseScanConfirm,
  onConfirmEnableWithScan,
  onCloseChangeFolderConfirm,
  onConfirmChangeFolderWhileRunning,
}: DesktopFolderWatcherPanelContentProps) {
  return (
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
              onClick={onPickWatchFolder}
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
            onChange={onEnabledChange}
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
                onClick={onPickMoveFolder}
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
          onClick={() => onSave(draft)}
          disabled={saving}
          className={desktopBtnSecondary}
        >
          {saving ? <Spinner className="size-4" /> : null}
          {t('saveSettings')}
        </button>
        {isRunning ? (
          <button type="button" onClick={onStop} disabled={stopping} className={desktopBtnPrimary}>
            {stopping ? <Spinner className="size-4" /> : null}
            {t('stopWatcher')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
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
              {watcherStatus.activity.map((entry) => (
                <li
                  key={`${entry.timestamp}-${entry.filename}-${entry.result}-${entry.detail ?? ''}`}
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
              onClick={onOpenUploads}
              className="text-xs font-medium text-accent hover:underline dark:text-accent-dark"
            >
              {t('openUploadsPage')}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted dark:text-muted-dark">{t('noActivity')}</p>
        )}
      </DesktopSubsection>

      <DesktopConfirmDialog
        open={showChangeFolderConfirm}
        onClose={onCloseChangeFolderConfirm}
        titleId="change-folder-confirm-title"
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
        titleId="scan-confirm-title"
        title={t('scanConfirmTitle')}
        cancelLabel={t('scanConfirmCancel')}
        confirmLabel={t('scanConfirmProceed')}
        onConfirm={onConfirmEnableWithScan}
      >
        {t('scanConfirmBody')}
      </DesktopConfirmDialog>
    </div>
  );
}
