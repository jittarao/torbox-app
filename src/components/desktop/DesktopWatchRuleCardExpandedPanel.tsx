'use client';

import type { PostUploadAction, WatchRule } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import {
  desktopBtnSecondary,
  desktopOptionBase,
  desktopOptionDefault,
  desktopOptionSelected,
  DesktopPathDisplay,
} from '@/components/desktop/DesktopUi';

type DesktopWatchRuleCardExpandedPanelProps = {
  rule: WatchRule;
  pickingWatchFolder: boolean;
  pickingMoveFolder: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onUpdateRule: (partial: Partial<WatchRule>) => void | Promise<void>;
  onPickWatchFolder: () => void;
  onPickMoveFolder: () => void;
};

export default function DesktopWatchRuleCardExpandedPanel({
  rule,
  pickingWatchFolder,
  pickingMoveFolder,
  t,
  onUpdateRule,
  onPickWatchFolder,
  onPickMoveFolder,
}: DesktopWatchRuleCardExpandedPanelProps) {
  const uploadedPreview = rule.watchPath ? `${rule.watchPath.replace(/\/$/, '')}/uploaded` : null;

  return (
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
          {(['delete', 'moveToUploaded', 'moveToCustom'] as PostUploadAction[]).map((action) => (
            <label
              key={action}
              className={`${desktopOptionBase} ${
                rule.postUploadAction === action ? desktopOptionSelected : desktopOptionDefault
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
          ))}
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
              <DesktopPathDisplay value={rule.customMovePath} emptyLabel={t('noFolderSelected')} />
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
  );
}
