'use client';

import { formatSize, formatSpeed, formatEta, timeAgo } from './utils/formatters';
import All from '@/components/icons/All';
import ArrowLeftRight from '@/components/icons/ArrowLeftRight';
import Clock from '@/components/icons/Clock';
import ClockArrowDown from '@/components/icons/ClockArrowDown';
import CloudDownload from '@/components/icons/CloudDownload';
import CloudUpload from '@/components/icons/CloudUpload';
import DownArrow from '@/components/icons/DownArrow';
import Download from '@/components/icons/Download';
import Files from '@/components/icons/Files';
import Hash from '@/components/icons/Hash';
import Layers from '@/components/icons/Layers';
import Link from '@/components/icons/Link';
import Lock from '@/components/icons/Lock';
import Percent from '@/components/icons/Percent';
import Private from '@/components/icons/Private';
import Tag from '@/components/icons/Tag';
import Unlock from '@/components/icons/Unlock';
import UpArrow from '@/components/icons/UpArrow';
import TagDisplay from './Tags/TagDisplay';
import { getItemFileCount } from '@/utils/downloadEntityFiles';

export const COLUMNS_WITH_INLINE_ICON = new Set(['airlocked', 'private', 'tags']);

export function normalizeBooleanValue(value) {
  return value === true || value === 1 || value === 'true';
}

export function getItemCardTooltipContent(column, columnT) {
  switch (column) {
    case 'id':
      return columnT('id');
    case 'hash':
      return columnT('hash');
    case 'seeds':
      return columnT('seeds');
    case 'peers':
      return columnT('peers');
    case 'ratio':
      return columnT('ratio');
    case 'size':
      return columnT('size');
    case 'file_count':
      return columnT('file_count');
    case 'created_at':
      return columnT('created_at');
    case 'cached_at':
      return columnT('cached_at');
    case 'updated_at':
      return columnT('updated_at');
    case 'expires_at':
      return columnT('expires_at');
    case 'eta':
      return columnT('eta');
    case 'total_downloaded':
      return columnT('total_downloaded');
    case 'total_uploaded':
      return columnT('total_uploaded');
    case 'original_url':
      return columnT('original_url');
    case 'download_progress':
      return columnT('download_progress');
    case 'asset_type':
      return columnT('asset_type');
    case 'private':
      return columnT('private');
    case 'airlocked':
      return columnT('airlocked');
    case 'tags':
      return columnT('tags');
  }
}

export function getItemCardColumnIcon(column) {
  switch (column) {
    case 'id':
      return <ArrowLeftRight />;
    case 'hash':
      return <Hash />;
    case 'seeds':
      return <UpArrow />;
    case 'peers':
      return <DownArrow />;
    case 'ratio':
      return <Percent />;
    case 'size':
      return <Layers />;
    case 'file_count':
      return <Files />;
    case 'created_at':
    case 'cached_at':
    case 'updated_at':
    case 'expires_at':
      return <Clock />;
    case 'eta':
      return <ClockArrowDown />;
    case 'total_downloaded':
      return <CloudDownload />;
    case 'total_uploaded':
      return <CloudUpload />;
    case 'original_url':
      return <Link />;
    case 'download_progress':
      return <Download />;
    case 'asset_type':
      return <All />;
    case 'private':
      return <Private />;
    case 'airlocked':
      return <Lock />;
    case 'tags':
      return <Tag />;
  }
}

export function ItemCardDownloadProgress({ item, commonT }) {
  if (!item.active || item.download_finished) {
    return null;
  }

  const downloadSpeed = item.download_speed || 0;
  const totalSize = item.size || 0;

  let progress = 0;
  let downloadedSize = 0;

  if (item.assetType === 'usenet' || item.assetType === 'webdl') {
    progress = (item.progress || 0) * 100;
    downloadedSize = totalSize * (item.progress || 0);
  } else {
    downloadedSize = item.total_downloaded || 0;
    if (totalSize > 0 && downloadedSize > 0) {
      progress = (downloadedSize / totalSize) * 100;
    } else if (item.progress !== undefined) {
      progress = (item.progress || 0) * 100;
      downloadedSize = totalSize * (item.progress || 0);
    }
  }

  const remainingSize = totalSize - downloadedSize;
  const etaSeconds = downloadSpeed > 0 ? remainingSize / downloadSpeed : 0;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="w-full bg-progress-track dark:bg-progress-track-dark rounded-full h-2">
        <div
          className="bg-accent dark:bg-accent-dark h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-primary-text/70 dark:text-primary-text-dark/70">
          {progress.toFixed(1)}%
        </span>
        <span className="text-primary-text/60 dark:text-primary-text-dark/60">
          {formatSize(downloadedSize)} / {formatSize(totalSize)}
        </span>
      </div>

      {downloadSpeed > 0 && (
        <div className="flex items-center justify-between text-xs text-primary-text/60 dark:text-primary-text-dark/60">
          <span>↓ {formatSpeed(downloadSpeed)}</span>
          {etaSeconds > 0 && <span>ETA: {formatEta(etaSeconds, commonT)}</span>}
        </div>
      )}
    </div>
  );
}

export function getItemCardColumnValue(column, item, commonT) {
  switch (column) {
    case 'id':
      return item.id;
    case 'hash':
      return item.hash;
    case 'seeds':
      return item.seeds;
    case 'peers':
      return item.peers;
    case 'ratio':
      return item.ratio?.toFixed(1);
    case 'size':
      return formatSize(item.size || 0);
    case 'file_count':
      return getItemFileCount(item);
    case 'created_at':
      return timeAgo(item.created_at, commonT);
    case 'cached_at':
      return timeAgo(item.cached_at, commonT);
    case 'updated_at':
      return timeAgo(item.updated_at, commonT);
    case 'expires_at':
      return timeAgo(item.expires_at, commonT);
    case 'eta':
      return timeAgo(item.eta, commonT);
    case 'total_downloaded':
      return formatSize(item.total_downloaded);
    case 'total_uploaded':
      return formatSize(item.total_uploaded);
    case 'download_progress':
      return <ItemCardDownloadProgress item={item} commonT={commonT} />;
    case 'original_url':
      return item.original_url;
    case 'asset_type':
      return (
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${
              item.assetType === 'torrents'
                ? 'bg-label-active-text dark:bg-label-active-text-dark'
                : item.assetType === 'usenet'
                  ? 'bg-label-success-text dark:bg-label-success-text-dark'
                  : item.assetType === 'webdl'
                    ? 'bg-accent dark:bg-accent-dark'
                    : 'bg-label-default-text dark:bg-label-default-text-dark'
            }`}
          ></span>
          <span className="capitalize">
            {item.assetType === 'torrents'
              ? 'Torrent'
              : item.assetType === 'usenet'
                ? 'Usenet'
                : item.assetType === 'webdl'
                  ? 'Web'
                  : 'Unknown'}
          </span>
        </div>
      );
    case 'private':
      return item.private ? (
        <div className="flex items-center gap-2">
          <Private className="size-4 text-orange-500 dark:text-orange-400" />
          <span>Private</span>
        </div>
      ) : (
        <span>Public</span>
      );
    case 'airlocked':
      return normalizeBooleanValue(item.airlocked) ? (
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-accent dark:text-accent-dark" />
          <span>{commonT('airlocked')}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Unlock className="size-4 text-primary-text/40 dark:text-primary-text-dark/40" />
          <span>{commonT('notAirlocked')}</span>
        </div>
      );
    case 'tags':
      return item.tags && item.tags.length > 0 ? <TagDisplay tags={item.tags} /> : null;
  }
}
