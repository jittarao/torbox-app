import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import ModalSheet from '@/components/shared/ModalSheet';
import Tooltip from '@/components/shared/Tooltip';
import { Question } from '@/components/icons';

export default function ActionButtonsConfirmModals({
  archiveModal,
  onCloseArchiveConfirm,
  onConfirmArchive,
  selectedArchivableCount,
  deleteModal,
  onCloseDeleteConfirm,
  onConfirmDelete,
  selectedItemCount,
  deleteParentFileCount,
  deleteParentDownloads,
  onDeleteParentDownloadsChange,
  itemTypeName,
  itemTypePlural,
}) {
  const t = useTranslations('ActionButtons');
  const { open: showArchiveConfirm, inProgress: isArchiving } = archiveModal;
  const { open: showDeleteConfirm, inProgress: isDeleting, hasSelectedFiles } = deleteModal;

  return (
    <>
      {showArchiveConfirm && (
        <ModalSheet
          open={showArchiveConfirm}
          onClose={onCloseArchiveConfirm}
          aria-labelledby="archive-confirm-title"
        >
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
            <h3
              id="archive-confirm-title"
              className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
            >
              {t('archiveConfirm.title')}
            </h3>
            <p className="mt-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
              {t('archiveConfirm.message', {
                count: selectedArchivableCount,
              })}
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCloseArchiveConfirm}
                className="ui-btn-ghost w-full justify-center sm:w-auto"
              >
                {t('archiveConfirm.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmArchive}
                disabled={isArchiving}
                className="ui-btn-accent w-full justify-center sm:w-auto disabled:opacity-50"
              >
                {t('archiveConfirm.confirm')}
              </button>
            </div>
          </div>
        </ModalSheet>
      )}

      {showDeleteConfirm && (
        <ModalSheet
          open={showDeleteConfirm}
          onClose={onCloseDeleteConfirm}
          aria-labelledby="delete-confirm-title"
        >
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
            <h3
              id="delete-confirm-title"
              className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
            >
              {t('deleteConfirm.title')}
            </h3>
            <p className="mt-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
              {t('deleteConfirm.message', {
                count: selectedItemCount + deleteParentFileCount,
                type: selectedItemCount === 1 ? itemTypeName : itemTypePlural,
              })}
            </p>

            {hasSelectedFiles && (
              <label className="mt-4 flex gap-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                <input
                  type="checkbox"
                  checked={deleteParentDownloads}
                  onChange={(e) => onDeleteParentDownloadsChange(e.target.checked)}
                  className="rounded border-gray-300 text-accent focus:ring-accent"
                />
                {t('deleteConfirm.includeParentDownloads')}
                <Tooltip content={t('deleteConfirm.includeParentDownloadsTooltip')}>
                  <Question />
                </Tooltip>
              </label>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCloseDeleteConfirm}
                className="ui-btn-ghost w-full justify-center sm:w-auto"
              >
                {t('deleteConfirm.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="inline-flex w-full items-center justify-center rounded-xl bg-label-danger-text px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-50 sm:w-auto dark:bg-label-danger-text-dark dark:hover:brightness-110"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </ModalSheet>
      )}
    </>
  );
}

export function confirmArchive({ onClose, onBulkArchive, selectedArchivableCount }) {
  onClose();
  onBulkArchive();
  phEvent('bulk_archive', { count: selectedArchivableCount });
}

export function confirmDelete({ onClose, onBulkDelete, deleteParentDownloads }) {
  onClose();
  onBulkDelete(deleteParentDownloads);
  phEvent('delete_items', {
    includeParents: deleteParentDownloads,
  });
}
