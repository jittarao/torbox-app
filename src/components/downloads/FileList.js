import { formatSize } from './utils/formatters';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import { useTranslations } from 'next-intl';

export default function FileList({
  files,
  itemId,
  selectedItems,
  isBlurred,
  onFileSelect,
  onFileDownload,
  isCopying,
  isDownloading,
  isMobile,
  isFileDownloaded,
}) {
  const t = useTranslations('FileActions');
  return (
    <div className="mt-4 border-t border-border/50 dark:border-border-dark/50 pt-4">
      <div className="space-y-2">
        {files.map((file, fileIndex) => {
          const isChecked =
            selectedItems.files.get(itemId)?.has(file.id) || false;
          const isDisabled = selectedItems.items?.has(itemId);
          const assetKey = `${itemId}-${file.id}`;

          return (
            <div
              key={`${itemId}-${file.id}`}
              className={`${
                isChecked
                  ? 'bg-accent/15 hover:bg-accent/20 dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
                  : isDisabled
                    ? 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                    : isFileDownloaded(itemId, file.id)
                      ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
                      : 'bg-accent/5 hover:bg-accent/10 dark:bg-surface-alt-dark/70 dark:hover:bg-surface-alt-selected-hover-dark/70'
              } rounded-md p-2 ${!isDisabled && 'cursor-pointer'}`}
              onMouseDown={(e) => {
                if (e.shiftKey) e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.target.closest('button') || isDisabled) return;
                onFileSelect(itemId, fileIndex, file, !isChecked, e.shiftKey);
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      onFileSelect(
                        itemId,
                        fileIndex,
                        file,
                        e.target.checked,
                        e.shiftKey,
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-accent dark:accent-accent-dark"
                  />

                  {/* Meta Data */}
                  <div
                    className={`grid items-center gap-3 min-w-0 flex-1 ${
                      isMobile
                        ? 'grid-cols-[1fr,auto]'
                        : 'grid-cols-[1fr,auto,auto]'
                    }`}
                  >
                    <span
                      className={`text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate ${
                        isBlurred ? 'blur-[6px] select-none' : ''
                      }`}
                      title={isBlurred ? '' : file.name}
                    >
                      {file.short_name || file.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap w-fit">
                      {formatSize(file.size || 0)}
                    </span>
                    {file.mimetype && !isMobile && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 text-accent dark:text-accent-dark whitespace-nowrap w-fit">
                        {file.mimetype}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDownload(itemId, file.id, true);
                    }}
                    disabled={isCopying[assetKey]}
                    className="p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                    title={t('copyLink')}
                  >
                    {isCopying[assetKey] ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icons.Copy />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDownload(itemId, file.id);
                    }}
                    disabled={isDownloading[assetKey]}
                    className="p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                    title={t('download')}
                  >
                    {isDownloading[assetKey] ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icons.Download />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
