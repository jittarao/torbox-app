import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UploadRow from './UploadRow';
import { normalizeUploadId } from './utils';

export default function UploadTable({
  uploads,
  enableDnd = false,
  onRetry,
  onDelete,
  onDownload,
  onCopy,
  retrying,
  deleting,
  downloading,
  copying,
  selectedUploads,
  onSelect,
  onSelectAll,
  copySuccess,
}) {
  const isUploadSelected = (upload) => {
    const id = normalizeUploadId(upload.id);
    return id != null && selectedUploads.has(id);
  };

  const selectedOnPage = uploads.filter(isUploadSelected).length;
  const allSelected = uploads.length > 0 && selectedOnPage === uploads.length;
  const someSelected = selectedOnPage > 0 && selectedOnPage < uploads.length;

  const tableContent = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border dark:border-border-dark">
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70 w-12">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelected;
                  }
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="size-4 accent-accent dark:accent-accent-dark cursor-pointer"
                aria-label="Select all uploads"
              />
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Name
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Type
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Status
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Created
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Last Processed
            </th>
            <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {enableDnd ? (
            <SortableContext
              items={uploads.map((u) => u.id)}
              strategy={verticalListSortingStrategy}
            >
              {uploads.map((upload) => (
                <UploadRow
                  key={upload.id}
                  upload={upload}
                  onRetry={onRetry}
                  onDelete={onDelete}
                  onDownload={onDownload}
                  onCopy={onCopy}
                  retrying={retrying}
                  deleting={deleting}
                  downloading={downloading}
                  copying={copying}
                  selected={isUploadSelected(upload)}
                  onSelect={onSelect}
                  copySuccess={copySuccess}
                  isSortable={true}
                />
              ))}
            </SortableContext>
          ) : (
            uploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                onRetry={onRetry}
                onDelete={onDelete}
                onDownload={onDownload}
                onCopy={onCopy}
                retrying={retrying}
                deleting={deleting}
                downloading={downloading}
                copying={copying}
                selected={isUploadSelected(upload)}
                onSelect={onSelect}
                copySuccess={copySuccess}
                isSortable={false}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return tableContent;
}
