import { useSortable } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import Tooltip from '@/components/shared/Tooltip';
import { formatDate, formatTimeAgo, normalizeUploadId, getUploadRowErrorMessage } from './utils';
import { STATUS_COLORS, TYPE_LABELS } from './constants';

function UploadDateCell({ dateString, t }) {
  if (!dateString) {
    return 'N/A';
  }

  return (
    <Tooltip content={formatDate(dateString)}>
      <span className="cursor-default">{formatTimeAgo(dateString, t)}</span>
    </Tooltip>
  );
}

export default function UploadRow({
  upload,
  onRetry,
  onDelete,
  onDownload,
  onCopy,
  retrying,
  deleting,
  downloading,
  copying,
  selected,
  onSelect,
  rowIndex,
  copySuccess,
  isSortable = false,
}) {
  const t = useTranslations('Common');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: upload.id,
    disabled: !isSortable,
  });

  const style = isSortable
    ? {
        transform: transform
          ? `translate3d(${transform.x ?? 0}px, ${transform.y ?? 0}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  const uploadId = normalizeUploadId(upload.id);
  const canDownload = upload.upload_type === 'file' && upload.file_path;
  const canCopy = (upload.upload_type === 'magnet' || upload.upload_type === 'link') && upload.url;
  const rowErrorMessage = getUploadRowErrorMessage(upload);

  const rowProps = isSortable
    ? {
        ref: setNodeRef,
        style,
      }
    : {};

  const handleRowSelect = (shiftKey) => {
    onSelect(upload.id, !selected, rowIndex, shiftKey);
  };

  return (
    <tr
      {...rowProps}
      aria-selected={selected}
      className={`border-b border-border dark:border-border-dark cursor-pointer hover:bg-surface-alt dark:hover:bg-surface-alt-dark ${
        selected
          ? 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark hover:bg-surface-alt-selected-hover dark:hover:bg-surface-alt-selected-hover-dark'
          : ''
      }`}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        handleRowSelect(e.shiftKey);
      }}
    >
      <td className="px-2.5 py-1.5 text-xs text-primary-text dark:text-primary-text-dark w-12">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          tabIndex={-1}
          style={{ pointerEvents: 'none' }}
          className="size-4 accent-accent dark:accent-accent-dark"
          aria-label={upload.name || 'Select upload'}
        />
      </td>
      <td className="px-2.5 py-1.5 text-xs text-primary-text dark:text-primary-text-dark">
        <div className="flex items-center gap-2">
          {isSortable && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-primary-text/50 dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark"
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="5" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </button>
          )}
          <div className="max-w-md truncate" title={upload.name}>
            {upload.name}
          </div>
        </div>
        {rowErrorMessage && (
          <div className="text-xs text-red-500 dark:text-red-400 mt-0.5" title={rowErrorMessage}>
            {rowErrorMessage}
          </div>
        )}
      </td>
      <td className="px-2.5 py-1.5 text-xs text-primary-text dark:text-primary-text-dark">
        {TYPE_LABELS[upload.type] || upload.type}
      </td>
      <td className="px-2.5 py-1.5">
        <span
          className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[upload.status] || STATUS_COLORS.queued}`}
        >
          {upload.status}
        </span>
      </td>
      <td className="px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70">
        <UploadDateCell dateString={upload.created_at} t={t} />
      </td>
      <td className="px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70">
        <UploadDateCell dateString={upload.last_processed_at} t={t} />
      </td>
      <td className="px-2.5 py-1.5">
        <div className="flex gap-1.5 items-center">
          {canDownload && (
            <button
              type="button"
              onClick={() => onDownload(upload.id)}
              disabled={uploadId != null && downloading.has(uploadId)}
              className="p-1 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
              title="Download original file"
              aria-label="Download original file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {canCopy && (
            <button
              type="button"
              onClick={() => onCopy(upload.url, upload.id)}
              disabled={uploadId != null && copying.has(uploadId)}
              className={`p-1 rounded transition-colors ${
                copySuccess === uploadId
                  ? 'text-green-500 dark:text-green-400 bg-green-500/20 dark:bg-green-400/20'
                  : 'text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
              }`}
              title={copySuccess === uploadId ? 'Copied!' : 'Copy link'}
              aria-label={copySuccess === uploadId ? 'Copied!' : 'Copy link'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
          {upload.status === 'failed' && (
            <button
              type="button"
              onClick={() => onRetry(upload.id)}
              disabled={uploadId != null && retrying.has(uploadId)}
              className="px-2 py-0.5 text-xs bg-accent text-white rounded hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90 disabled:opacity-50"
            >
              {uploadId != null && retrying.has(uploadId) ? 'Retrying...' : 'Retry'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(upload.id)}
            disabled={uploadId == null || deleting.has(uploadId)}
            className="px-2 py-0.5 text-xs bg-label-danger-text dark:bg-label-danger-text-dark text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadId != null && deleting.has(uploadId) ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
