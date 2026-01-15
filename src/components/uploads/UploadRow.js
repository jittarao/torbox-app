import { useSortable } from '@dnd-kit/sortable';
import { formatErrorMessage, formatDate } from './utils';
import { STATUS_COLORS, TYPE_LABELS } from './constants';

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
  copySuccess,
  isSortable = false,
}) {
  const sortableProps = isSortable
    ? useSortable({
        id: upload.id,
      })
    : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortableProps || {};

  const style = isSortable
    ? {
        transform: transform
          ? `translate3d(${transform.x ?? 0}px, ${transform.y ?? 0}px, 0)`
          : undefined,
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : {};

  const canDownload = upload.upload_type === 'file' && upload.file_path;
  const canCopy = (upload.upload_type === 'magnet' || upload.upload_type === 'link') && upload.url;

  const rowProps = isSortable
    ? {
        ref: setNodeRef,
        style,
      }
    : {};

  return (
    <tr
      {...rowProps}
      className={`border-b border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark ${
        selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark w-12">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(upload.id, e.target.checked)}
          className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        <div className="flex items-center gap-2">
          {isSortable && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-primary-text/50 dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark"
              title="Drag to reorder"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
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
        {upload.error_message && (
          <div className="text-xs text-red-500 dark:text-red-400 mt-1" title={upload.error_message}>
            {formatErrorMessage(upload.error_message)}
          </div>
        )}
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        {TYPE_LABELS[upload.type] || upload.type}
      </td>
      <td className="p-3">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[upload.status] || STATUS_COLORS.queued}`}
        >
          {upload.status}
        </span>
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.created_at)}
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.last_processed_at)}
      </td>
      <td className="p-3">
        <div className="flex gap-2 items-center">
          {canDownload && (
            <button
              onClick={() => onDownload(upload.id)}
              disabled={downloading.has(upload.id)}
              className="p-1.5 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
              title="Download original file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
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
              onClick={() => onCopy(upload.url, upload.id)}
              disabled={copying.has(upload.id)}
              className={`p-1.5 rounded transition-colors ${
                copySuccess === upload.id
                  ? 'text-green-500 dark:text-green-400 bg-green-500/20 dark:bg-green-400/20'
                  : 'text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
              }`}
              title={copySuccess === upload.id ? 'Copied!' : 'Copy link'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
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
              onClick={() => onRetry(upload.id)}
              disabled={retrying.has(upload.id)}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {retrying.has(upload.id) ? 'Retrying...' : 'Retry'}
            </button>
          )}
          <button
            onClick={() => onDelete(upload.id)}
            disabled={deleting.has(upload.id)}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {deleting.has(upload.id) ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
