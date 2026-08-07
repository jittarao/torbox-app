'use client';

import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import { Bolt, Layers, Copy, Download, Torrent, Usenet, Link } from '@/components/icons';
import { formatSize } from '@/components/downloads/utils/formatters';
import { streamToUploadTarget, triggerBrowserDownload } from '@/utils/stremioStreamNormalize';

const SOURCE_STYLES = {
  torrent: {
    icon: Torrent,
    label: 'torrent',
    className: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400',
  },
  usenet: {
    icon: Usenet,
    label: 'usenet',
    className: 'bg-purple-500/10 text-purple-600 dark:bg-purple-400/10 dark:text-purple-400',
  },
  link: {
    icon: Link,
    label: 'link',
    className:
      'bg-primary-text/5 text-primary-text/60 dark:bg-primary-text-dark/5 dark:text-primary-text-dark/60',
  },
};

function SourceBadge({ kind }) {
  if (!kind || !SOURCE_STYLES[kind]) return null;
  const { icon: Icon, label, className } = SOURCE_STYLES[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function ActionButtons({ item, target, isUploading, isAdded, onCopyLink, onUpload, t, dense }) {
  const btnPad = dense ? 'px-2 py-1' : 'px-2.5 py-1.5';
  const handleDownload = () => {
    if (!item.url) return;
    triggerBrowserDownload(item.url, item.filename || undefined);
  };

  const copyLabel = target.kind === 'magnet' ? t('actions.copyMagnet') : t('actions.copyLink');

  return (
    <div className={`flex shrink-0 flex-wrap items-center ${dense ? 'gap-1' : 'gap-1.5'}`}>
      {target.copyValue ? (
        <button
          type="button"
          onClick={() => onCopyLink(item)}
          aria-label={copyLabel}
          title={copyLabel}
          className={`inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-surface ${btnPad} text-xs font-medium text-primary-text transition-colors hover:bg-surface-alt dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark`}
        >
          <Copy className="size-3.5" />
          {dense ? null : copyLabel}
        </button>
      ) : null}

      {target.kind === 'link' && item.url ? (
        <button
          type="button"
          onClick={handleDownload}
          aria-label={t('actions.download')}
          title={t('actions.download')}
          className={`inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-surface ${btnPad} text-xs font-medium text-primary-text transition-colors hover:bg-surface-alt dark:border-border-dark/80 dark:bg-surface-dark dark:text-primary-text-dark dark:hover:bg-surface-alt-dark`}
        >
          <Download className="size-3.5" />
          {dense ? null : t('actions.download')}
        </button>
      ) : null}

      {target.canUpload || target.canSilentAdd ? (
        <button
          type="button"
          onClick={() => onUpload(item)}
          disabled={isUploading || isAdded}
          aria-label={
            isUploading
              ? t('actions.adding')
              : isAdded
                ? t('actions.added')
                : t('actions.addToTorBox')
          }
          className={`inline-flex items-center gap-1.5 rounded-md ${btnPad} text-xs font-medium text-white transition-colors ${
            isUploading
              ? 'cursor-not-allowed bg-primary-text/30 dark:bg-primary-text-dark/30'
              : isAdded
                ? 'cursor-not-allowed bg-label-success-text/60 dark:bg-emerald-700/60'
                : 'bg-label-success-text hover:bg-label-success-text/90 dark:bg-emerald-700 dark:hover:bg-emerald-600'
          }`}
        >
          {isUploading ? (
            <>
              <Spinner size="sm" className="text-white" />
              {dense ? null : t('actions.adding')}
            </>
          ) : isAdded ? (
            t('actions.added')
          ) : (
            t('actions.addToTorBox')
          )}
        </button>
      ) : null}
    </div>
  );
}

function CompactStreamCard({ item, isUploading, isAdded, onCopyLink, onUpload, t }) {
  const target = streamToUploadTarget(item);
  const sourceKind = item.nzbUrl ? 'usenet' : item.infoHash ? 'torrent' : item.url ? 'link' : null;
  const compactBadges = [item.resolution, item.codec, item.hdr].filter(Boolean);

  return (
    <article
      className="group flex items-center gap-2.5 rounded-md border border-border/70 bg-surface px-2.5 py-2 transition-colors hover:border-border dark:border-border-dark/70 dark:bg-surface-dark dark:hover:border-border-dark sm:gap-3 sm:px-3"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
    >
      {item.addonLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.addonLogo}
          alt=""
          referrerPolicy="no-referrer"
          className="size-7 shrink-0 rounded object-contain"
        />
      ) : (
        <div className="size-7 shrink-0 rounded bg-surface-alt dark:bg-surface-alt-dark" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3 className="min-w-0 truncate text-sm font-medium text-primary-text dark:text-primary-text-dark">
            {item.title}
          </h3>
          {item.cached ? (
            <Bolt
              className="size-3.5 shrink-0 text-green-600 dark:text-green-400"
              aria-label={t('metadata.cached')}
            />
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-[10px] text-primary-text/55 dark:text-primary-text-dark/55">
          {item.addonName ? (
            <span className="truncate text-accent dark:text-accent-dark">{item.addonName}</span>
          ) : null}
          <SourceBadge kind={sourceKind} />
          {compactBadges.map((badge, index) => (
            <span
              key={`${badge}-${index}`}
              className="rounded bg-surface-alt px-1 py-px dark:bg-surface-alt-dark"
            >
              {badge}
            </span>
          ))}
          {item.size != null ? (
            <span className="inline-flex items-center gap-0.5 font-medium">
              <Layers className="size-3 opacity-50" />
              {formatSize(item.size)}
            </span>
          ) : null}
        </div>
      </div>

      <ActionButtons
        item={item}
        target={target}
        isUploading={isUploading}
        isAdded={isAdded}
        onCopyLink={onCopyLink}
        onUpload={onUpload}
        t={t}
        dense
      />
    </article>
  );
}

function FullStreamCard({ item, isUploading, isAdded, onCopyLink, onUpload, t }) {
  const target = streamToUploadTarget(item);
  const sourceKind = item.nzbUrl ? 'usenet' : item.infoHash ? 'torrent' : item.url ? 'link' : null;
  const qualityBadges = [
    item.resolution,
    item.quality,
    item.codec,
    item.hdr,
    item.audio,
    item.language,
  ].filter(Boolean);

  return (
    <article
      className="group overflow-hidden rounded-lg border border-border/70 bg-surface transition-shadow hover:border-border hover:shadow-xs dark:border-border-dark/70 dark:bg-surface-dark dark:hover:border-border-dark"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 120px' }}
    >
      <div className="p-3 sm:p-3.5">
        <div className="flex min-w-0 items-start gap-3">
          {item.addonLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.addonLogo}
              alt=""
              referrerPolicy="no-referrer"
              className="mt-0.5 size-8 shrink-0 rounded-md object-contain"
            />
          ) : (
            <div className="mt-0.5 size-8 shrink-0 rounded-md bg-surface-alt dark:bg-surface-alt-dark" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <h3 className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-primary-text dark:text-primary-text-dark sm:text-base">
                {item.title}
              </h3>
              {item.cached && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">
                  <Bolt className="size-3" />
                  {t('metadata.cached')}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.addonName && (
                <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent dark:bg-accent-dark/15 dark:text-accent-dark">
                  {item.addonName}
                </span>
              )}
              <SourceBadge kind={sourceKind} />
              {item.streamType && (
                <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60">
                  {item.streamType}
                </span>
              )}
              {qualityBadges.map((badge, index) => (
                <span
                  key={`${badge}-${index}`}
                  className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] text-primary-text/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/60"
                >
                  {badge}
                </span>
              ))}
              {(item.sources || []).length > 1 && (
                <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[10px] text-primary-text/50 dark:bg-surface-alt-dark dark:text-primary-text-dark/50">
                  {t('metadata.sources', { count: item.sources.length })}
                </span>
              )}
            </div>
          </div>
        </div>

        {item.description ? (
          <div className="mt-3 pl-11">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-primary-text/55 dark:text-primary-text-dark/55">
              {item.description}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border/50 bg-surface-alt/30 px-3 py-2.5 dark:border-border-dark/50 dark:bg-surface-alt-dark/20 sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-primary-text/55 dark:text-primary-text-dark/55">
          {item.size != null && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Layers className="size-3.5 text-primary-text/35 dark:text-primary-text-dark/35" />
              {formatSize(item.size)}
            </span>
          )}
        </div>

        <ActionButtons
          item={item}
          target={target}
          isUploading={isUploading}
          isAdded={isAdded}
          onCopyLink={onCopyLink}
          onUpload={onUpload}
          t={t}
          dense={false}
        />
      </div>
    </article>
  );
}

export default function SearchResultRow({
  item,
  isUploading,
  isAdded,
  onCopyLink,
  onUpload,
  density = 'full',
}) {
  const t = useTranslations('SearchResults');

  if (density === 'compact') {
    return (
      <CompactStreamCard
        item={item}
        isUploading={isUploading}
        isAdded={isAdded}
        onCopyLink={onCopyLink}
        onUpload={onUpload}
        t={t}
      />
    );
  }

  return (
    <FullStreamCard
      item={item}
      isUploading={isUploading}
      isAdded={isAdded}
      onCopyLink={onCopyLink}
      onUpload={onUpload}
      t={t}
    />
  );
}
