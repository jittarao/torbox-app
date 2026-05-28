'use client';

import { useCallback, useEffect, useState } from 'react';
import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

const COPIED_FEEDBACK_MS = 2000;

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function getFileExtension(name) {
  if (!name || typeof name !== 'string') return null;
  const base = name.split('/').pop() || name;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
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
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark text-muted dark:text-muted-dark"
        aria-hidden
      >
        <Icons.File className="size-4" />
      </span>
    );
  }

  const style = EXTENSION_STYLES[extension] || 'bg-accent/10 text-accent dark:text-accent-dark';

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold uppercase tracking-wide ${style}`}
      aria-hidden
    >
      {extension.length > 4 ? extension.slice(0, 3) : extension}
    </span>
  );
}

function PanelHeader({ downloadLinks, isDownloading, downloadProgress, isOpen, onToggle, t }) {
  const count = downloadLinks.length;
  const progressPercent =
    downloadProgress.total > 0
      ? Math.round((downloadProgress.current / downloadProgress.total) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      aria-expanded={isOpen}
      aria-label={isOpen ? t('aria.collapse') : t('aria.expand')}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-accent-dark/10 dark:text-accent-dark">
        <Icons.Download className="size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            {count > 1 ? t('title.multiple') : t('title.single')}
          </h3>
          {count > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
              {t('badge.ready', { count })}
            </span>
          )}
        </div>

        {isDownloading ? (
          <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">
            {t('status.fetching', {
              current: downloadProgress.current,
              total: downloadProgress.total,
            })}
          </p>
        ) : count > 0 ? (
          <p className="mt-0.5 text-xs text-muted dark:text-muted-dark">{t('status.generated')}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted dark:text-muted-dark animate-pulse">
            {t('status.generating')}
          </p>
        )}

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

      <span className="shrink-0 text-primary-text/60 dark:text-primary-text-dark/60">
        {isOpen ? (
          <Icons.ChevronDown className="size-5" aria-hidden />
        ) : (
          <Icons.ChevronUp className="size-5" aria-hidden />
        )}
      </span>
    </button>
  );
}

function LinkRow({ link, index, total, copiedId, onCopy, onDownload, t }) {
  const displayName = getDisplayName(link);
  const extension = getFileExtension(displayName);
  const hostname = getHostname(link.url);
  const isCopied = copiedId === link.id;

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border/80 bg-surface-alt/80 p-2.5 transition-colors hover:border-accent/30 hover:bg-surface-alt dark:border-border-dark/80 dark:bg-surface-alt-dark/80 dark:hover:border-accent-dark/30 dark:hover:bg-surface-alt-dark">
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

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(link);
          }}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
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
            <Icons.Check className="size-4" aria-hidden />
          ) : (
            <Icons.Copy className="size-4" aria-hidden />
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
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 dark:text-accent-dark dark:hover:bg-accent-dark/10"
          title={t('actions.downloadFile')}
          aria-label={t('actions.downloadFileWithIndex', { index, total })}
        >
          <Icons.Download className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t('actions.open')}</span>
        </button>
      </div>
    </li>
  );
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
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

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

  const handleDownloadFile = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = useCallback(
    (link) => {
      navigator.clipboard
        .writeText(link.url)
        .then(() => {
          setCopiedId(link.id);
          setToast({
            message: t('toast.linkCopied'),
            type: 'success',
          });
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

  if (!downloadLinks.length && !isDownloading) return null;

  const handleDismiss = () => {
    setCopiedId(null);
    setCopiedAll(false);
    onDismiss();
  };

  const panelShell = (
    <div className="overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl shadow-black/20 dark:border-border-dark dark:bg-surface-dark dark:shadow-black/50">
      <div className="border-b border-border dark:border-border-dark">
        <PanelHeader
          downloadLinks={downloadLinks}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          isOpen={isDownloadPanelOpen}
          onToggle={() => setIsDownloadPanelOpen(!isDownloadPanelOpen)}
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
                className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-muted-dark dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark"
              >
                {t('actions.clearAll')}
              </button>
              <button
                type="button"
                onClick={handleCopyLinks}
                disabled={downloadLinks.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-40 dark:bg-accent-dark dark:hover:bg-accent-dark/90"
              >
                {copiedAll ? (
                  <Icons.Check className="size-4" aria-hidden />
                ) : (
                  <Icons.Copy className="size-4" aria-hidden />
                )}
                {copiedAll ? t('actions.copied') : t('actions.copyAll')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {isDownloadPanelOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:bg-black/40"
          aria-label={t('aria.collapse')}
          onClick={() => setIsDownloadPanelOpen(false)}
        />
      )}

      <div className="fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-height,0px)+env(safe-area-inset-bottom,0px))] z-50 md:bottom-0">
        <div className="relative mx-auto max-w-2xl px-3 sm:px-4">{panelShell}</div>
      </div>
    </>
  );
}
