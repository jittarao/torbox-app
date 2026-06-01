'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Edit, Hash, MagnifyingGlass, Plus, Trash, X } from '@/components/icons';
import { useTags } from '@/components/shared/hooks/useTags';
import OverlayPortal from '@/components/shared/OverlayPortal';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import { TAG_SEARCH_MIN_COUNT } from './constants';

function TagRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-alt/40 px-3 py-2.5 dark:border-border-dark/50 dark:bg-surface-alt-dark/30 animate-pulse">
      <div className="h-4 w-24 rounded-md bg-zinc-200 dark:bg-zinc-700" />
      <div className="ml-auto h-3 w-12 rounded bg-zinc-200/80 dark:bg-zinc-700/80" />
    </div>
  );
}

function TagRow({
  tag,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  pendingDelete,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  loading,
  t,
  tActions,
}) {
  const isPendingDelete = pendingDelete?.id === tag.id;

  if (isPendingDelete) {
    return (
      <li
        className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-3 dark:border-red-400/25 dark:bg-red-500/10"
        role="alert"
      >
        <p className="text-sm text-primary-text dark:text-primary-text-dark leading-snug">
          {t('confirmDeleteTag', { name: tag.name })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancelDelete}
            disabled={loading}
            className="ui-btn-ghost !py-1.5 !px-3 !text-xs"
          >
            {tActions('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirmDelete}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
              text-white bg-red-600 hover:bg-red-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            {loading ? (
              <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Trash className="size-3.5" aria-hidden />
            )}
            {t('menuDelete')}
          </button>
        </div>
      </li>
    );
  }

  if (isEditing) {
    return (
      <li className="rounded-xl border border-accent/30 bg-accent/5 px-2 py-2 dark:border-accent-dark/30 dark:bg-accent-dark/5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent dark:bg-accent-dark/15 dark:text-accent-dark"
            aria-hidden
          >
            <Hash className="size-4" />
          </span>
          <input
            type="text"
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            className="min-w-0 flex-1 rounded-lg border border-border/80 bg-surface px-3 py-2 text-sm
              text-primary-text placeholder:text-primary-text/40
              focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20
              dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark
              dark:focus:border-accent-dark/50 dark:focus:ring-accent-dark/20"
            aria-label={t('menuRename')}
            autoFocus
          />
          <button
            type="button"
            onClick={onSaveEdit}
            disabled={loading || !editName.trim()}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg
              bg-accent text-white hover:bg-accent/90
              disabled:opacity-50 disabled:cursor-not-allowed
              dark:bg-accent-dark dark:hover:bg-accent-dark/90
              transition-colors"
            title={tActions('save')}
          >
            <Check className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg
              text-primary-text/70 hover:bg-surface-alt hover:text-primary-text
              dark:text-primary-text-dark/70 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark
              transition-colors"
            title={tActions('cancel')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className="group flex items-center gap-2 rounded-xl border border-border/50 bg-surface-alt/30 px-2 py-1.5
        transition-colors hover:border-border hover:bg-surface-alt/60
        dark:border-border-dark/50 dark:bg-surface-alt-dark/20 dark:hover:border-border-dark dark:hover:bg-surface-alt-dark/40"
    >
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg
          bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark"
        aria-hidden
      >
        <Hash className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary-text dark:text-primary-text-dark">
        {tag.name}
      </span>
      {tag.usage_count !== undefined && (
        <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-text/55 dark:bg-surface-dark dark:text-primary-text-dark/55">
          {t('tagUsageCount', { count: tag.usage_count })}
        </span>
      )}
      <div
        className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
      >
        <button
          type="button"
          onClick={onStartEdit}
          className="inline-flex size-8 items-center justify-center rounded-lg
            text-primary-text/60 hover:bg-surface hover:text-accent
            dark:text-primary-text-dark/60 dark:hover:bg-surface-dark dark:hover:text-accent-dark
            transition-colors"
          title={t('menuRename')}
        >
          <Edit className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          className="inline-flex size-8 items-center justify-center rounded-lg
            text-primary-text/60 hover:bg-red-500/10 hover:text-red-600
            dark:text-primary-text-dark/60 dark:hover:bg-red-500/15 dark:hover:text-red-400
            transition-colors"
          title={t('menuDelete')}
        >
          <Trash className="size-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/**
 * TagManager — modal for creating, renaming, and deleting tags.
 */
export default function TagManager({ isOpen, onClose, apiKey }) {
  const t = useTranslations('DownloadsFilters');
  const tActions = useTranslations('CustomViews');
  const tCommon = useTranslations('Common');
  const { tags, loading, createTag, updateTag, deleteTag } = useTags(apiKey);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const createInputRef = useRef(null);
  const dialogRef = useRef(null);

  const resetState = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setNewTagName('');
    setSearchQuery('');
    setPendingDelete(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }
    requestAnimationFrame(() => createInputRef.current?.focus());
  }, [isOpen, resetState]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (editingId != null) {
        setEditingId(null);
        setEditName('');
        return;
      }
      if (pendingDelete) {
        setPendingDelete(null);
        return;
      }
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, editingId, pendingDelete, onClose]);

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [tags]
  );

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedTags;
    return sortedTags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [sortedTags, searchQuery]);

  const showSearch = sortedTags.length > TAG_SEARCH_MIN_COUNT;

  const handleStartEdit = (tag) => {
    setPendingDelete(null);
    setEditingId(tag.id);
    setEditName(tag.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateTag(editingId, editName.trim());
      handleCancelEdit();
    } catch {
      // useTags surfaces errors
    }
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await createTag(name);
      setNewTagName('');
      createInputRef.current?.focus();
    } catch {
      // useTags surfaces errors
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTag(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      // useTags surfaces errors
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      <button
        type="button"
        className="z-overlay-backdrop fixed inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('close')}
      />

      <dialog
        ref={dialogRef}
        className="ui-modal-sheet"
        aria-labelledby="tag-manager-title"
        aria-describedby="tag-manager-description"
        aria-modal="true"
        open
      >
        <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
          <ModalSheetHandle />
          {/* Header */}
          <div className="relative shrink-0 border-b border-border/50 px-4 pb-2.5 sm:overflow-hidden sm:px-5 sm:pb-4 sm:pt-5 dark:border-border-dark/50">
            <div
              className="pointer-events-none absolute inset-0 hidden bg-gradient-to-br from-accent/8 via-transparent to-transparent dark:from-accent-dark/10 sm:block"
              aria-hidden
            />
            <div className="relative flex items-center gap-2 sm:items-start sm:gap-3">
              <div
                className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20 dark:bg-accent-dark/15 dark:text-accent-dark dark:ring-accent-dark/25 sm:flex"
                aria-hidden
              >
                <Hash className="size-5" />
              </div>
              <div className="min-w-0 flex-1 sm:pt-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    id="tag-manager-title"
                    className="truncate text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-lg"
                  >
                    {t('manageTags')}
                  </h2>
                  {tags.length > 0 && (
                    <span className="shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60">
                      {t('tagCountBadge', { count: tags.length })}
                    </span>
                  )}
                </div>
                <p
                  id="tag-manager-description"
                  className="mt-1 hidden text-sm leading-relaxed text-primary-text/60 dark:text-primary-text-dark/60 sm:block"
                >
                  {t('tagManagerDescription')}
                </p>
                <p className="sr-only sm:hidden">{t('tagManagerDescription')}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark sm:-mt-1 sm:size-9 sm:rounded-xl"
                aria-label={t('close')}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Composer */}
          <div className="shrink-0 border-b border-border/40 px-4 py-3 sm:px-5 sm:py-4 dark:border-border-dark/40">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Plus
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35"
                  aria-hidden
                />
                <input
                  ref={createInputRef}
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={t('newTagPrompt')}
                  disabled={loading}
                  className="w-full rounded-xl border border-border/80 bg-surface-alt/50 py-2.5 pl-9 pr-3 text-sm
                    text-primary-text placeholder:text-primary-text/40
                    focus:border-accent/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15
                    disabled:opacity-60
                    dark:border-border-dark/80 dark:bg-surface-alt-dark/40 dark:text-primary-text-dark
                    dark:focus:border-accent-dark/50 dark:focus:bg-surface-dark dark:focus:ring-accent-dark/15"
                  aria-label={t('newTag')}
                />
              </div>
              <button
                type="submit"
                disabled={!newTagName.trim() || loading}
                className="ui-btn-accent w-full shrink-0 justify-center !rounded-xl !px-4 sm:w-auto"
              >
                {loading ? (
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  t('newTag')
                )}
              </button>
            </form>

            {showSearch && (
              <div className="relative mt-3">
                <MagnifyingGlass
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-text/35 dark:text-primary-text-dark/35"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('tagManagerSearchPlaceholder')}
                  className="w-full rounded-xl border border-border/60 bg-transparent py-2 pl-9 pr-3 text-sm
                    text-primary-text placeholder:text-primary-text/40
                    focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/10
                    dark:border-border-dark/60 dark:text-primary-text-dark
                    dark:focus:border-accent-dark/40 dark:focus:ring-accent-dark/10"
                  aria-label={t('tagManagerSearchPlaceholder')}
                />
              </div>
            )}
          </div>

          {/* Tag list */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            {loading && tags.length === 0 ? (
              <ul className="space-y-2" aria-busy="true" aria-label={tCommon('loading')}>
                {[0, 1, 2].map((i) => (
                  <TagRowSkeleton key={i} />
                ))}
              </ul>
            ) : tags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div
                  className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark"
                  aria-hidden
                >
                  <Hash className="size-7 opacity-80" />
                </div>
                <p className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                  {t('noTags')}
                </p>
                <p className="mt-1 max-w-[16rem] text-sm text-primary-text/55 dark:text-primary-text-dark/55">
                  {t('tagManagerEmptyHint')}
                </p>
              </div>
            ) : filteredTags.length === 0 ? (
              <p className="py-8 text-center text-sm text-primary-text/60 dark:text-primary-text-dark/60">
                {t('tagManagerNoResults', { query: searchQuery.trim() })}
              </p>
            ) : (
              <ul className="space-y-1.5" role="list">
                {filteredTags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    isEditing={editingId === tag.id}
                    editName={editName}
                    onEditNameChange={setEditName}
                    onStartEdit={() => handleStartEdit(tag)}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    pendingDelete={pendingDelete}
                    onRequestDelete={() => {
                      handleCancelEdit();
                      setPendingDelete({ id: tag.id, name: tag.name });
                    }}
                    onConfirmDelete={handleConfirmDelete}
                    onCancelDelete={() => setPendingDelete(null)}
                    loading={loading}
                    t={t}
                    tActions={tActions}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );

  return <OverlayPortal open={isOpen}>{modalContent}</OverlayPortal>;
}
