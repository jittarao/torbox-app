import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import UploadRow from './UploadRow';

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
  const allSelected = uploads.length > 0 && selectedUploads.size === uploads.length;
  const someSelected = selectedUploads.size > 0 && selectedUploads.size < uploads.length;

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
                className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
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
                  selected={selectedUploads.has(upload.id)}
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
                selected={selectedUploads.has(upload.id)}
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
