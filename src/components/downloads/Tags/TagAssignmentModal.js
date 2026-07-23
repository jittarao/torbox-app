'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Hash, Plus, Times, X } from '@/components/icons';
import TagSelector from './TagSelector';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';

const EMPTY_ARRAY = [];

/**
 * TagAssignmentModal — assign or remove tags on one or more downloads.
 */
export default function TagAssignmentModal({
  isOpen,
  onClose,
  downloadIds = EMPTY_ARRAY,
  apiKey,
  onSuccess,
}) {
  const t = useTranslations('DownloadsFilters');
  const tActions = useTranslations('CustomViews');
  const { assignTags, getDownloadTags, fetchDownloadTags, tagMappings } = useDownloadTags(apiKey);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [mode, setMode] = useState('add');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setSelectedTagIds([]);
    setMode('add');
    if (isOpen) {
      fetchDownloadTags({ force: true });
    }
  }

  const downloadCount = downloadIds.length;

  /** Union of tags on any selected download (for remove mode). */
  const assignedTagsUnion = useMemo(() => {
    if (!isOpen || downloadCount === 0) return [];

    const byId = new Map();
    for (const downloadId of downloadIds) {
      for (const tag of getDownloadTags(downloadId)) {
        const key = Number(tag.id);
        if (!byId.has(key)) {
          byId.set(key, { id: tag.id, name: tag.name });
        }
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [isOpen, downloadIds, downloadCount, getDownloadTags, tagMappings]);

  const handleSubmit = async () => {
    if (!downloadCount || !selectedTagIds.length) return;

    setIsAssigning(true);
    try {
      await assignTags(downloadIds, selectedTagIds, mode);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(`Error ${mode === 'add' ? 'assigning' : 'removing'} tags:`, error);
    } finally {
      setIsAssigning(false);
    }
  };

  const description =
    mode === 'add'
      ? downloadCount === 1
        ? t('tagAssignmentDescriptionAddSingle')
        : t('tagAssignmentDescriptionAddMulti', { count: downloadCount })
      : downloadCount === 1
        ? t('tagAssignmentDescriptionRemoveSingle')
        : t('tagAssignmentDescriptionRemoveMulti', { count: downloadCount });

  const canSubmit =
    selectedTagIds.length > 0 && !(mode === 'remove' && assignedTagsUnion.length === 0);

  return (
    <ModalSheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t('close')}
      aria-labelledby="tag-assignment-title"
      aria-describedby="tag-assignment-description"
    >
      <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
        <ModalSheetHandle />

        {/* Header */}
        <div className="relative shrink-0 border-b border-border/50 px-4 pb-3 sm:px-5 sm:pb-4 sm:pt-5 dark:border-border-dark/50">
          <div
            className="pointer-events-none absolute inset-0 hidden bg-gradient-to-br from-accent/8 via-transparent to-transparent dark:from-accent-dark/10 sm:block"
            aria-hidden
          />
          <div className="relative flex items-start gap-3">
            <div
              className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20 dark:bg-accent-dark/15 dark:text-accent-dark dark:ring-accent-dark/25 sm:flex"
              aria-hidden
            >
              <Hash className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h2
                  id="tag-assignment-title"
                  className="truncate text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-lg"
                >
                  {t('tagAssignmentTitle')}
                </h2>
                {downloadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60">
                    {t('tagAssignmentDownloadCount', { count: downloadCount })}
                  </span>
                )}
              </div>
              <p
                id="tag-assignment-description"
                className="mt-1 text-sm leading-relaxed text-primary-text/60 dark:text-primary-text-dark/60"
              >
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark sm:size-9 sm:rounded-xl"
              aria-label={t('close')}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {/* Mode toggle */}
          <div
            className="relative mt-3 flex rounded-xl border border-border/60 bg-surface-alt/40 p-1 dark:border-border-dark/60 dark:bg-surface-alt-dark/30"
            role="tablist"
            aria-label={t('tagAssignmentModeLabel')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'add'}
              onClick={() => {
                setMode('add');
                setSelectedTagIds([]);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'add'
                  ? 'bg-surface text-primary-text shadow-sm dark:bg-surface-dark dark:text-primary-text-dark'
                  : 'text-primary-text/65 hover:text-primary-text dark:text-primary-text-dark/65 dark:hover:text-primary-text-dark'
              }`}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t('tagAssignmentModeAdd')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'remove'}
              onClick={() => {
                setMode('remove');
                setSelectedTagIds([]);
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'remove'
                  ? 'bg-surface text-primary-text shadow-sm dark:bg-surface-dark dark:text-primary-text-dark'
                  : 'text-primary-text/65 hover:text-primary-text dark:text-primary-text-dark/65 dark:hover:text-primary-text-dark'
              }`}
            >
              <Times className="size-4 shrink-0" aria-hidden />
              {t('tagAssignmentModeRemove')}
            </button>
          </div>
        </div>

        {/* Tag picker */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
          {mode === 'remove' && assignedTagsUnion.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                {t('tagAssignmentNoAssignedTags')}
              </p>
              <p className="mt-1 max-w-xs text-sm text-primary-text/55 dark:text-primary-text-dark/55">
                {t('tagAssignmentNoAssignedTagsHint')}
              </p>
            </div>
          ) : (
            <>
              {selectedTagIds.length > 0 && (
                <p className="mb-2 text-xs font-medium text-primary-text/55 dark:text-primary-text-dark/55">
                  {t('tagAssignmentSelectedCount', { count: selectedTagIds.length })}
                </p>
              )}
              <TagSelector
                value={selectedTagIds}
                onChange={setSelectedTagIds}
                apiKey={apiKey}
                allowCreate={mode === 'add'}
                tagOptions={mode === 'remove' ? assignedTagsUnion : null}
                variant={mode}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-5 sm:py-4 dark:border-border-dark/50">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-ghost w-full justify-center sm:w-auto"
            >
              {tActions('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isAssigning || !canSubmit}
              className={
                mode === 'remove'
                  ? `inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                        text-white bg-red-600 hover:bg-red-500
                        transition-colors active:scale-[0.98]
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40
                        disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`
                  : 'ui-btn-accent w-full justify-center sm:w-auto'
              }
            >
              {isAssigning ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {mode === 'add'
                    ? t('tagAssignmentSubmittingAdd')
                    : t('tagAssignmentSubmittingRemove')}
                </span>
              ) : mode === 'add' ? (
                t('tagAssignmentSubmitAdd')
              ) : (
                t('tagAssignmentSubmitRemove')
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalSheet>
  );
}
