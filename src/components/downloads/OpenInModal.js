'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, Play, X } from '@/components/icons';
import Infuse from '@/components/icons/Infuse';
import Iina from '@/components/icons/Iina';
import WebPlayer from '@/components/icons/WebPlayer';
import ModalSheet from '@/components/shared/ModalSheet';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';
import { formatSize } from './utils/formatters';
import { getDisplayMimetype } from './utils/mimetypeDisplay';
import { isAudioFile, isVideoFile } from './utils/videoDetection';

const PLAYER_OPTIONS = [
  { id: 'web', icon: WebPlayer, platformKey: null, brand: false, external: false },
  { id: 'infuse', icon: Infuse, platformKey: 'infuse', brand: true, external: true },
  { id: 'iina', icon: Iina, platformKey: 'iina', brand: true, external: true },
];

function getFileExtensionLabel(filename) {
  const ext = (filename?.split('.').pop() || '').toLowerCase();
  return ext ? ext.toUpperCase() : null;
}

function getMediaKind(file, t) {
  if (!file) return null;
  if (isVideoFile(file)) return t('fileMeta.video');
  if (isAudioFile(file)) return t('fileMeta.audio');
  return null;
}

function FileMetaBadge({ children, accent = false }) {
  return (
    <span
      className={
        accent
          ? 'inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent dark:bg-accent-dark/10 dark:text-accent-dark'
          : 'inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-primary-text/70 ring-1 ring-border/60 dark:bg-surface-dark dark:text-primary-text-dark/70 dark:ring-border-dark/60'
      }
    >
      {children}
    </span>
  );
}

export default function OpenInModal({
  isOpen,
  onClose,
  onSelect,
  file = null,
  fileName,
  itemName = null,
  isLoading = false,
  loadingChoice = null,
  error = null,
}) {
  const t = useTranslations('OpenIn');
  const locale = useLocale();

  const displayName = file?.short_name || file?.name || fileName;
  const showSource = itemName && displayName && itemName.trim() !== displayName.trim();

  const fileMeta = useMemo(() => {
    if (!file && !displayName) return null;

    const resolvedFile = file || { name: displayName };
    const sizeLabel = resolvedFile.size > 0 ? formatSize(resolvedFile.size, locale) : null;
    const extension = getFileExtensionLabel(
      resolvedFile.short_name || resolvedFile.name || displayName
    );
    const mimetype = resolvedFile.mimetype
      ? getDisplayMimetype(
          resolvedFile.mimetype,
          resolvedFile.name || resolvedFile.short_name || displayName
        )
      : null;
    const mediaKind = getMediaKind(resolvedFile, t);

    return { sizeLabel, extension, mimetype, mediaKind };
  }, [file, displayName, locale, t]);

  return (
    <ModalSheet
      open={isOpen}
      onClose={onClose}
      closeLabel={t('close')}
      aria-labelledby="open-in-title"
      aria-describedby={displayName ? 'open-in-description' : undefined}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
        <ModalSheetHandle />

        <div className="relative shrink-0 border-b border-border/50 px-4 pb-4 sm:px-5 sm:pb-5 sm:pt-5 dark:border-border-dark/50">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="open-in-title"
              className="text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-lg"
            >
              {t('title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="shrink-0 rounded-lg p-1.5 text-primary-text/70 transition-colors hover:bg-surface-alt hover:text-primary-text disabled:opacity-50 dark:text-primary-text-dark/70 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
              aria-label={t('close')}
            >
              <X className="size-5" />
            </button>
          </div>

          {displayName ? (
            <div
              id="open-in-description"
              className="mt-3 rounded-xl border border-border/60 bg-surface-alt/80 p-3 dark:border-border-dark/60 dark:bg-surface-alt-dark/80 sm:p-3.5"
            >
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark">
                  <Play className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Tooltip content={displayName}>
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-primary-text dark:text-primary-text-dark">
                      {displayName}
                    </p>
                  </Tooltip>
                  {showSource ? (
                    <p className="mt-1 line-clamp-1 text-xs text-primary-text/55 dark:text-primary-text-dark/55">
                      <span className="text-primary-text/45 dark:text-primary-text-dark/45">
                        {t('fileMeta.from')}
                      </span>{' '}
                      {itemName}
                    </p>
                  ) : null}
                  {fileMeta &&
                  (fileMeta.sizeLabel ||
                    fileMeta.mediaKind ||
                    fileMeta.extension ||
                    fileMeta.mimetype) ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {fileMeta.sizeLabel ? (
                        <FileMetaBadge>{fileMeta.sizeLabel}</FileMetaBadge>
                      ) : null}
                      {fileMeta.mediaKind ? (
                        <FileMetaBadge accent>{fileMeta.mediaKind}</FileMetaBadge>
                      ) : null}
                      {fileMeta.extension ? (
                        <FileMetaBadge>{fileMeta.extension}</FileMetaBadge>
                      ) : null}
                      {fileMeta.mimetype ? (
                        <FileMetaBadge>
                          <span className="max-w-[9rem] truncate">{fileMeta.mimetype}</span>
                        </FileMetaBadge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {error ? (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-primary-text/45 dark:text-primary-text-dark/45">
            {t('choosePlayer')}
          </p>

          <ul className="space-y-2">
            {PLAYER_OPTIONS.map(({ id, icon: Icon, platformKey, brand, external }) => {
              const isChoiceLoading = isLoading && loadingChoice === id;
              const isDisabled = isLoading;
              const iconWrapClass = brand
                ? 'bg-surface ring-1 ring-border/70 dark:bg-surface-dark dark:ring-border-dark/70'
                : 'bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark';

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSelect(id)}
                    disabled={isDisabled}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-all hover:border-accent/50 hover:bg-surface-alt hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:bg-surface-dark dark:hover:border-accent-dark/50 dark:hover:bg-surface-alt-dark"
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${iconWrapClass}`}
                    >
                      {isChoiceLoading ? <Spinner size="sm" /> : <Icon className="size-6" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-primary-text dark:text-primary-text-dark">
                        {t(`players.${id}`)}
                      </span>
                      {platformKey ? (
                        <span className="mt-0.5 block text-xs text-primary-text/55 dark:text-primary-text-dark/55">
                          {t(`platforms.${platformKey}`)}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-primary-text/55 dark:text-primary-text-dark/55">
                          {t('players.webHint')}
                        </span>
                      )}
                    </span>
                    {external && !isChoiceLoading ? (
                      <ExternalLink className="size-4 shrink-0 text-primary-text/30 transition-colors group-hover:text-accent dark:text-primary-text-dark/30 dark:group-hover:text-accent-dark" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {isLoading ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-primary-text/60 dark:text-primary-text-dark/60">
              <Spinner size="sm" />
              {t('preparingStream')}
            </p>
          ) : null}
        </div>
      </div>
    </ModalSheet>
  );
}
