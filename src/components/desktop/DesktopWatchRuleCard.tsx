'use client';

import type { PostUploadAction, WatchRule, WatchRuleStatus } from '@/desktop/capabilities';
import { ChevronDown, Trash } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import DesktopConfirmDialog from '@/components/desktop/DesktopConfirmDialog';
import {
  desktopBtnDanger,
  desktopBtnSecondary,
  DesktopInfoCallout,
  desktopOptionBase,
  desktopOptionDefault,
  desktopOptionSelected,
  DesktopPathDisplay,
  DesktopStatusBadge,
  DesktopToggle,
} from '@/components/desktop/DesktopUi';

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

function getFolderLabel(path: string | null, emptyLabel: string): string {
  if (!path) {
    return emptyLabel;
  }
  const normalized = path.replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

function getPostUploadActionLabel(
  action: PostUploadAction,
  t: DesktopWatchRuleCardProps['t']
): string {
  switch (action) {
    case 'delete':
      return t('actionDeleteShort');
    case 'moveToUploaded':
      return t('actionMoveToUploadedShort');
    case 'moveToCustom':
      return t('actionMoveToCustomShort');
    default:
      return action;
  }
}

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
  const uploadedPreview = rule.watchPath ? `${rule.watchPath.replace(/\/$/, '')}/uploaded` : null;
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
    <article
      className={`overflow-hidden rounded-xl border transition-colors ${
        ruleStatus?.active
          ? 'border-label-success-text/30 bg-label-success-bg/20 dark:border-label-success-text-dark/35 dark:bg-label-success-bg-dark/15'
          : 'border-border/60 bg-white dark:border-border-dark/60 dark:bg-surface-alt-dark'
      }`}
    >
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

      {ruleStatus?.lastError ? (
        <div className="px-3 pb-3 sm:px-4">
          <DesktopInfoCallout variant="warning">{ruleStatus.lastError}</DesktopInfoCallout>
        </div>
      ) : null}

      {expanded ? (
        <div
          id={`watch-rule-panel-${rule.id}`}
          className="space-y-4 border-t border-border/50 px-3 py-4 dark:border-border-dark/50 sm:px-4 sm:py-5"
        >
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-medium text-text dark:text-text-dark">
                {t('subsections.setup')}
              </h5>
              <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">
                {t('subsections.setupDescription')}
              </p>
            </div>
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
              {rule.watchPath ? (
                <button
                  type="button"
                  onClick={() => onUpdateRule({ watchPath: null })}
                  className={desktopBtnSecondary}
                >
                  {t('clearFolder')}
                </button>
              ) : null}
            </div>
            <DesktopPathDisplay value={rule.watchPath} emptyLabel={t('noFolderSelected')} />
          </section>

          <section className="space-y-3 border-t border-border/40 pt-4 dark:border-border-dark/40">
            <div>
              <h5 className="text-sm font-medium text-text dark:text-text-dark">
                {t('subsections.behavior')}
              </h5>
              <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">
                {t('subsections.behaviorDescription')}
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="sr-only">{t('postUploadAction')}</legend>
              {(['delete', 'moveToUploaded', 'moveToCustom'] as PostUploadAction[]).map(
                (action) => (
                  <label
                    key={action}
                    className={`${desktopOptionBase} ${
                      rule.postUploadAction === action
                        ? desktopOptionSelected
                        : desktopOptionDefault
                    }`}
                  >
                    <input
                      type="radio"
                      name={`postUploadAction-${rule.id}`}
                      checked={rule.postUploadAction === action}
                      onChange={() => onUpdateRule({ postUploadAction: action })}
                      className="mt-1 accent-accent dark:accent-accent-dark"
                    />
                    <span className="text-sm">
                      {action === 'delete' && t('actionDelete')}
                      {action === 'moveToUploaded' && t('actionMoveToUploaded')}
                      {action === 'moveToCustom' && t('actionMoveToCustom')}
                    </span>
                  </label>
                )
              )}
              {rule.postUploadAction === 'moveToUploaded' && uploadedPreview ? (
                <DesktopPathDisplay value={uploadedPreview} emptyLabel={t('noFolderSelected')} />
              ) : null}
              {rule.postUploadAction === 'moveToCustom' ? (
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
                  <DesktopPathDisplay
                    value={rule.customMovePath}
                    emptyLabel={t('noFolderSelected')}
                  />
                </div>
              ) : null}
            </fieldset>
          </section>

          <section className="space-y-3 border-t border-border/40 pt-4 dark:border-border-dark/40">
            <div>
              <h5 className="text-sm font-medium text-text dark:text-text-dark">
                {t('subsections.options')}
              </h5>
              <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">
                {t('subsections.optionsDescription')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-white px-3 py-2.5 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
                <input
                  type="checkbox"
                  checked={rule.torrentOptions.seed === 1}
                  onChange={(e) =>
                    onUpdateRule({
                      torrentOptions: {
                        ...rule.torrentOptions,
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
                  checked={rule.torrentOptions.allowZip}
                  onChange={(e) =>
                    onUpdateRule({
                      torrentOptions: {
                        ...rule.torrentOptions,
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
                  checked={rule.torrentOptions.asQueued}
                  onChange={(e) =>
                    onUpdateRule({
                      torrentOptions: {
                        ...rule.torrentOptions,
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
                  checked={rule.torrentOptions.addOnlyIfCached}
                  onChange={(e) =>
                    onUpdateRule({
                      torrentOptions: {
                        ...rule.torrentOptions,
                        addOnlyIfCached: e.target.checked,
                      },
                    })
                  }
                />
                {t('optionAddOnlyIfCached')}
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-white px-3 py-3 text-sm text-text dark:border-border-dark/50 dark:bg-surface-dark dark:text-text-dark">
              <input
                type="checkbox"
                checked={rule.scanExistingOnEnable}
                onChange={(e) => onUpdateRule({ scanExistingOnEnable: e.target.checked })}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t('scanExisting')}</span>
                <span className="mt-0.5 block text-xs text-muted dark:text-muted-dark">
                  {t('scanExistingHelp')}
                </span>
              </span>
            </label>
          </section>
        </div>
      ) : null}

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
    </article>
  );
}
