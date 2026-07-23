import { memo } from 'react';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import DownloadProgressDisplay from './DownloadProgressDisplay';
import Tooltip from '@/components/shared/Tooltip';
import Lock from '@/components/icons/Lock';
import Shield from '@/components/icons/Shield';
import Private from '@/components/icons/Private';
import Unlock from '@/components/icons/Unlock';
import TagDisplay from './Tags/TagDisplay';
import { tableDataCellPad, tableDataCellText } from './utils/responsiveLayout';
import { getItemFileCount } from '@/utils/downloadEntityFiles';

function normalizeBooleanValue(value) {
  return value === true || value === 1 || value === 'true';
}

function ItemRowCell({ item, columnId, style, isBlurred, isMobile, commonT }) {
  switch (columnId) {
    case 'name': {
      const isAirlocked = normalizeBooleanValue(item.airlocked);
      const isProtected = item.is_protected === true;
      return (
        <td className={`${tableDataCellPad} relative overflow-hidden`} style={style}>
          <div
            className={`text-sm md:text-xs lg:text-sm text-primary-text dark:text-primary-text-dark min-w-0 cursor-pointer ${isBlurred ? 'blur-[6px] select-none' : ''}`}
          >
            <div
              className={`flex gap-2 min-w-0 ${isMobile ? 'items-start flex-wrap' : 'items-center'}`}
            >
              <Tooltip content={item.cached ? 'Cached' : 'Not cached'}>
                <span
                  className={`inline-block shrink-0 size-2 rounded-full ${
                    item.cached
                      ? 'bg-label-success-text-dark dark:bg-label-success-text-dark'
                      : 'bg-label-danger-text-dark dark:bg-label-danger-text-dark'
                  }`}
                ></span>
              </Tooltip>
              {item.private && (
                <Tooltip content="Private Tracker">
                  <Private className="size-4 shrink-0 text-accent dark:text-accent-dark" />
                </Tooltip>
              )}
              {isAirlocked && (
                <Tooltip content={commonT('airlocked')}>
                  <Lock className="size-4 shrink-0 text-accent dark:text-accent-dark" />
                </Tooltip>
              )}
              {isProtected && (
                <Tooltip content={commonT('protected')}>
                  <Shield className="size-4 shrink-0 text-accent dark:text-accent-dark" />
                </Tooltip>
              )}
              {item.name && (
                <Tooltip content={!isBlurred ? item.name : ''}>
                  <span className={isMobile ? 'break-words min-w-0' : 'truncate'}>
                    {item.name || 'Unnamed Item'}
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
          {isMobile && (
            <div className="flex flex-col mt-1 text-xs text-primary-text/60 dark:text-primary-text-dark/60 gap-2">
              <div className="flex flex-col items-start gap-2">
                {item.download_state && <DownloadStateBadge item={item} size="xs" />}
                {item.active && !item.download_finished && (
                  <div className="w-full min-w-0">
                    <DownloadProgressDisplay item={item} variant="compact" />
                  </div>
                )}
                {(!item.active || item.download_finished) && (
                  <>
                    <span>{formatSize(item.size || 0)}</span>
                    {item.created_at && <span>{timeAgo(item.created_at, commonT)}</span>}
                  </>
                )}
              </div>
            </div>
          )}
        </td>
      );
    }
    case 'size':
      return (
        <td className={tableDataCellText} style={style}>
          {formatSize(item.size || 0)}
        </td>
      );
    case 'created_at':
    case 'cached_at':
    case 'updated_at':
    case 'expires_at':
      return (
        <td className={`${tableDataCellText} relative group`} style={style}>
          <div className="cursor-default">
            {item[columnId] ? (
              <Tooltip content={formatDate(item[columnId])}>
                <span>{timeAgo(item[columnId], commonT)}</span>
              </Tooltip>
            ) : (
              'Unknown'
            )}
          </div>
        </td>
      );
    case 'download_state':
      return (
        <td className={`${tableDataCellPad} overflow-hidden whitespace-nowrap`} style={style}>
          <DownloadStateBadge item={item} />
        </td>
      );
    case 'progress':
      return (
        <td className={tableDataCellText} style={style}>
          <div className="w-full bg-progress-track dark:bg-progress-track-dark rounded-full h-2.5">
            <div
              className="bg-accent dark:bg-accent-dark h-2.5 rounded-full"
              style={{ width: `${(item.progress || 0) * 100}%` }}
            ></div>
          </div>
          <span className="text-xs">{((item.progress || 0) * 100).toFixed(1)}%</span>
        </td>
      );
    case 'download_progress':
      return (
        <td className={tableDataCellText} style={style}>
          <DownloadProgressDisplay item={item} variant="full" />
        </td>
      );
    case 'ratio':
      return (
        <td className={tableDataCellText} style={style}>
          {(item.ratio || 0).toFixed(2)}
        </td>
      );
    case 'download_speed':
    case 'upload_speed':
      return (
        <td className={tableDataCellText} style={style}>
          {formatSpeed(item[columnId])}
        </td>
      );
    case 'eta':
      return (
        <td className={tableDataCellText} style={style}>
          {formatEta(item.eta, commonT)}
        </td>
      );
    case 'id':
      return (
        <td className={tableDataCellText} style={style}>
          {item.id}
        </td>
      );
    case 'total_uploaded':
    case 'total_downloaded':
      return (
        <td className={tableDataCellText} style={style}>
          {formatSize(item[columnId] || 0)}
        </td>
      );
    case 'seeds':
    case 'peers':
      return (
        <td className={tableDataCellText} style={style}>
          {item[columnId] || 0}
        </td>
      );
    case 'file_count':
      return (
        <td className={tableDataCellText} style={style}>
          {getItemFileCount(item)}
        </td>
      );
    case 'asset_type':
      return (
        <td className={tableDataCellText} style={style}>
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
        </td>
      );
    case 'private':
      return (
        <td className={tableDataCellText} style={style}>
          {item.private ? (
            <div className="flex items-center gap-2">
              <Private className="size-4 text-orange-500 dark:text-orange-400" />
              <span>Private</span>
            </div>
          ) : (
            <span>Public</span>
          )}
        </td>
      );
    case 'airlocked': {
      const isAirlocked = normalizeBooleanValue(item.airlocked);
      return (
        <td className={tableDataCellText} style={style}>
          <div className="flex items-center gap-2">
            {isAirlocked ? (
              <Lock className="size-4 text-accent dark:text-accent-dark" />
            ) : (
              <Unlock className="size-4 text-primary-text/40 dark:text-primary-text-dark/40" />
            )}
            <span>{isAirlocked ? commonT('airlocked') : commonT('notAirlocked')}</span>
          </div>
        </td>
      );
    }
    case 'error': {
      const error = item.error?.trim() || null;
      return (
        <td
          className={`${tableDataCellPad} overflow-hidden text-sm md:text-xs lg:text-sm text-red-500`}
          style={style}
        >
          {error ? (
            <Tooltip content={error}>
              <span className="block min-w-0 truncate">{error}</span>
            </Tooltip>
          ) : null}
        </td>
      );
    }
    case 'tags':
      return (
        <td
          className={`${tableDataCellPad} overflow-hidden text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
          style={style}
        >
          {item.tags && item.tags.length > 0 ? (
            <TagDisplay tags={item.tags} />
          ) : (
            <span className="text-primary-text/40 dark:text-primary-text-dark/40">-</span>
          )}
        </td>
      );
    default: {
      const value = item[columnId];
      const display = value == null || value === '' ? null : String(value);
      return (
        <td
          className={`${tableDataCellPad} overflow-hidden text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
          style={style}
        >
          {display ? (
            <Tooltip content={display}>
              <span className="block min-w-0 truncate">{display}</span>
            </Tooltip>
          ) : (
            <span className="text-primary-text/40 dark:text-primary-text-dark/40">-</span>
          )}
        </td>
      );
    }
  }
}

export default memo(ItemRowCell);
