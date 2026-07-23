'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Download, File, X } from '@/components/icons';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import OverlayPortal from '@/components/shared/OverlayPortal';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

const COPIED_FEEDBACK_MS = 2000;
const PEEK_HEIGHT = '4.5rem';

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const COMPOUND_EXTENSIONS = ['tar.gz', 'tar.bz2', 'tar.xz', 'tar.zst', 'nzb.gz'];

function getExtensionFromFilename(name) {
  if (!name || typeof name !== 'string') return null;
  const base = (name.split('/').pop() || name).trim();
  if (!base) return null;

  const lower = base.toLowerCase();
  for (const compound of COMPOUND_EXTENSIONS) {
    if (lower.endsWith(`.${compound}`)) return compound;
  }

  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,12}$/i.test(ext)) return null;
  return ext;
}

function getFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.searchParams.get('filename');
    if (filename) return decodeURIComponent(filename);

    const segment = parsed.pathname.split('/').pop();
    if (segment && segment.includes('.')) return decodeURIComponent(segment);
  } catch {
    /* ignore */
  }
  return null;
}

function resolveLinkExtension(link) {
  const candidates = [link.name, getFilenameFromUrl(link.url)];
  for (const candidate of candidates) {
    const ext = getExtensionFromFilename(candidate);
    if (ext) return ext;
  }
  return null;
}

function formatExtensionLabel(extension) {
  const lower = extension.toLowerCase();
  if (lower.includes('.')) {
    if (lower.startsWith('tar.')) {
      return lower.split('.').pop().toUpperCase().slice(0, 4);
    }
    return lower.replace(/\./g, '').toUpperCase().slice(0, 4);
  }
  const upper = lower.toUpperCase();
  return upper.length <= 4 ? upper : upper.slice(0, 4);
}

function getExtensionStyle(extension) {
  if (EXTENSION_STYLES[extension]) return EXTENSION_STYLES[extension];
  const tail = extension.includes('.') ? extension.split('.').pop() : extension;
  return EXTENSION_STYLES[tail] || 'bg-accent/10 text-accent dark:text-accent-dark';
}

function getDisplayName(link) {
  if (link.name?.trim()) return link.name.trim();
  try {
    const params = new URL(link.url).searchParams;
    const filename = params.get('filename');
    if (filename) return decodeURIComponent(filename);
  } catch {
    /* ignore */
  }
  const host = getHostname(link.url);
  return host || link.url;
}

const EXTENSION_STYLES = {
  zip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  rar: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  '7z': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  gz: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bz2: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  xz: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  zst: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  mkv: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  mp4: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  avi: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  mp3: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  flac: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  m4a: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  pdf: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  epub: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

function ExtensionBadge({ extension }) {
  if (!extension) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-muted dark:bg-surface-alt-dark dark:text-muted-dark"
        aria-hidden
      >
        <File className="size-4" />
      </span>
    );
  }

  const label = formatExtensionLabel(extension);
  const style = getExtensionStyle(extension);
  const isCompactLabel = label.length <= 3;

  return (
    <span
      title={extension}
      className={`flex h-9 shrink-0 items-center justify-center rounded-lg px-1 font-semibold uppercase tracking-wide ${style} ${
        isCompactLabel ? 'min-w-9 text-[11px]' : 'min-w-[2.35rem] text-[9px] leading-none'
      }`}
      aria-hidden
    >
      {label}
    </span>
  );
}

function PanelHeader({
  downloadLinks,
  isDownloading,
  downloadProgress,
  isOpen,
  onToggle,
  onDismiss,
  titleId,
  t,
}) {
  const count = downloadLinks.length;
  const progressPercent =
    downloadProgress.total > 0
      ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
      : 0;

  const statusText = isDownloading
    ? downloadProgress.total > 0
      ? t('status.fetchingWithPercent', {
          current: downloadProgress.current,
          total: downloadProgress.total,
          percent: progressPercent,
        })
      : t('status.fetching', {
          current: downloadProgress.current,
          total: downloadProgress.total,
        })
    : count > 0
      ? t('status.generated')
      : t('status.generating');

  return (
    <div className="flex w-full items-stretch">
      <div className="flex min-w-0 flex-1 items-center gap-3 p-3 pr-1 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark">
          <Download className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={titleId}
              className="text-sm font-semibold text-primary-text dark:text-primary-text-dark"
            >
              {count > 1 ? t('title.multiple') : t('title.single')}
            </h3>
            {count > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                {t('badge.ready', { count })}
              </span>
            )}
          </div>

          <p
            className={`mt-0.5 text-xs text-muted dark:text-muted-dark ${!isDownloading && count === 0 ? 'animate-pulse' : ''}`}
            aria-live="polite"
          >
            {statusText}
          </p>

          {isDownloading && downloadProgress.total > 0 && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-progress-track dark:bg-progress-track-dark">
              <progress
                className="block h-full w-full appearance-none border-none [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:bg-accent dark:[&::-webkit-progress-value]:bg-accent-dark [&::-moz-progress-bar]:bg-accent dark:[&::-moz-progress-bar]:bg-accent-dark"
                value={downloadProgress.current}
                max={downloadProgress.total}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 self-center pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? t('aria.collapse') : t('aria.expand')}
          className="inline-flex size-8 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
        >
          {isOpen ? (
            <ChevronDown className="size-5" aria-hidden />
          ) : (
            <ChevronUp className="size-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-8 items-center justify-center rounded-lg text-primary-text/50 transition-colors hover:bg-surface-alt hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-primary-text-dark/50 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
          aria-label={t('aria.dismiss')}
          title={t('actions.done')}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function actionButtonClass(accent = false) {
  return `inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors sm:min-h-0 sm:min-w-0 sm:py-1.5 ${
    accent
      ? 'text-accent hover:bg-accent/10 dark:text-accent-dark dark:hover:bg-accent-dark/10'
      : ''
  }`;
}

function LinkRow({ link, index, total, copiedId, onCopy, onDownload, t }) {
  const displayName = getDisplayName(link);
  const extension = resolveLinkExtension(link);
  const hostname = getHostname(link.url);
  const isCopied = copiedId === link.id;

  return (
    <li className="group flex flex-col gap-2 rounded-xl border border-border/80 bg-surface-alt/80 p-2.5 transition-colors hover:border-accent/30 hover:bg-surface-alt dark:border-border-dark/80 dark:bg-surface-alt-dark/80 dark:hover:border-accent-dark/30 dark:hover:bg-surface-alt-dark sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="hidden w-6 shrink-0 text-center text-[11px] tabular-nums text-muted dark:text-muted-dark sm:block">
          {index}
        </span>

        <ExtensionBadge extension={extension} />

        <div className="min-w-0 flex-1">
          <Tooltip content={displayName}>
            <p className="truncate text-sm font-medium text-primary-text dark:text-primary-text-dark">
              {displayName}
            </p>
          </Tooltip>
          {hostname && (
            <Tooltip content={link.url}>
              <p className="mt-0.5 truncate text-[11px] text-muted dark:text-muted-dark">
                {hostname}
              </p>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(link);
          }}
          className={`${actionButtonClass()} ${
            isCopied
              ? 'bg-label-success-bg text-label-success-text dark:bg-label-success-bg-dark dark:text-label-success-text-dark'
              : 'text-accent hover:bg-accent/10 dark:text-accent-dark dark:hover:bg-accent-dark/10'
          }`}
          title={isCopied ? t('actions.copied') : t('actions.copyLink')}
          aria-label={
            isCopied ? t('actions.copied') : t('actions.copyLinkWithIndex', { index, total })
          }
        >
          {isCopied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {isCopied ? t('actions.copied') : t('actions.copy')}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(link.url);
          }}
          className={actionButtonClass(true)}
          title={t('actions.downloadFile')}
          aria-label={t('actions.downloadFileWithIndex', { index, total })}
        >
          <Download className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t('actions.open')}</span>
        </button>
      </div>
    </li>
  );
}

function handleDownloadFile(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function DownloadPanel({
  downloadLinks,
  isDownloading,
  downloadProgress,
  onDismiss,
  setToast,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
}) {
  const t = useTranslations('DownloadPanel');
  const titleId = useId();
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const isVisible = downloadLinks.length > 0 || isDownloading;

  useEffect(() => {
    if (!isVisible) return undefined;
    document.documentElement.style.setProperty('--download-panel-peek-height', PEEK_HEIGHT);
    return () => {
      document.documentElement.style.setProperty('--download-panel-peek-height', '0px');
    };
  }, [isVisible]);

  const shouldLockScroll = isVisible && isDownloadPanelOpen;

  useEffect(() => {
    if (!shouldLockScroll) return undefined;

    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [shouldLockScroll]);

  useEffect(() => {
    if (!isDownloadPanelOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsDownloadPanelOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDownloadPanelOpen, setIsDownloadPanelOpen]);

  useEffect(() => {
    if (copiedId == null) return undefined;
    const id = setTimeout(() => setCopiedId(null), COPIED_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copiedId]);

  useEffect(() => {
    if (!copiedAll) return undefined;
    const id = setTimeout(() => setCopiedAll(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [copiedAll]);

  const handleCopyLinks = useCallback(() => {
    const text = downloadLinks.map((link) => link.url).join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedAll(true);
        setToast({
          message: t('toast.linksCopied'),
          type: 'success',
        });
      })
      .catch(() => {
        setToast({
          message: t('toast.copyAllFailed'),
          type: 'error',
        });
      });
  }, [downloadLinks, setToast, t]);

  const handleCopyLink = useCallback(
    (link) => {
      navigator.clipboard
        .writeText(link.url)
        .then(() => {
          setCopiedId(link.id);
        })
        .catch(() => {
          setToast({
            message: t('toast.copyFailed'),
            type: 'error',
          });
        });
    },
    [setToast, t]
  );

  if (!isVisible) return null;

  const handleDismiss = () => {
    setCopiedId(null);
    setCopiedAll(false);
    setIsDownloadPanelOpen(false);
    onDismiss();
  };

  const handleCollapse = () => setIsDownloadPanelOpen(false);

  const panelPositionClass =
    'fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-height,0px)+env(safe-area-inset-bottom,0px))] md:bottom-0';

  const panelShell = (
    <div
      className="overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/20 dark:border-border-dark dark:bg-surface-dark dark:shadow-black/50"
      role={isDownloadPanelOpen ? 'dialog' : undefined}
      aria-modal={isDownloadPanelOpen ? 'true' : undefined}
      aria-labelledby={isDownloadPanelOpen ? titleId : undefined}
    >
      {isDownloadPanelOpen && <ModalSheetHandle />}

      <div className="border-b border-border dark:border-border-dark">
        <PanelHeader
          downloadLinks={downloadLinks}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          isOpen={isDownloadPanelOpen}
          onToggle={() => setIsDownloadPanelOpen(!isDownloadPanelOpen)}
          onDismiss={handleDismiss}
          titleId={titleId}
          t={t}
        />
      </div>

      {isDownloadPanelOpen && (
        <>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-3">
            {downloadLinks.length === 0 && isDownloading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent dark:border-accent-dark/30 dark:border-t-accent-dark" />
                <p className="text-sm text-muted dark:text-muted-dark">{t('status.generating')}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {downloadLinks.map((link, idx) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    index={idx + 1}
                    total={downloadLinks.length}
                    copiedId={copiedId}
                    onCopy={handleCopyLink}
                    onDownload={handleDownloadFile}
                    t={t}
                  />
                ))}
                {isDownloading && downloadLinks.length < downloadProgress.total && (
                  <li className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted dark:border-border-dark dark:text-muted-dark">
                    <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent dark:border-accent-dark/30 dark:border-t-accent-dark" />
                    {downloadLinks.length > 0 ? t('status.generatingMore') : t('status.generating')}
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="border-t border-border bg-surface-alt/50 p-3 dark:border-border-dark dark:bg-surface-alt-dark/50">
            <p className="mb-3 text-center text-[11px] text-muted dark:text-muted-dark">
              {t('hint.expiry')}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-muted-dark dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
              >
                {t('actions.done')}
              </button>
              <button
                type="button"
                onClick={handleCopyLinks}
                disabled={downloadLinks.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-40 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
              >
                {copiedAll ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
                {copiedAll ? t('actions.copied') : t('actions.copyAll')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const panelContent = (
    <div className={`${panelPositionClass} ${isDownloadPanelOpen ? 'z-[1]' : 'z-overlay-dialog'}`}>
      <div className="relative mx-auto max-w-2xl px-3 sm:px-4">{panelShell}</div>
    </div>
  );

  return (
    <OverlayPortal open={isVisible}>
      {isDownloadPanelOpen ? (
        <div className="ui-modal-overlay">
          <button
            type="button"
            className="ui-modal-overlay__backdrop"
            aria-label={t('aria.collapse')}
            onClick={handleCollapse}
          />
          {panelContent}
        </div>
      ) : (
        panelContent
      )}
    </OverlayPortal>
  );
}
