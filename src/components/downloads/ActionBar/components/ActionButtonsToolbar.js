import { useTranslations } from 'next-intl';
import {
  Archive,
  Delete,
  Download,
  FileDown,
  Lock,
  Play,
  Refresh,
  Stop,
  Tag,
  Times,
  Unlock,
  Shield,
} from '@/components/icons';
import BulkActionButton from './BulkActionButton';
import TagAssignmentModal from '../../Tags/TagAssignmentModal';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import ActionButtonsConfirmModals, {
  confirmArchive,
  confirmDelete,
} from './ActionButtonsConfirmModals';

export default function ActionButtonsToolbar({
  activeType,
  selectedItemCount,
  hasSelectedFiles,
  isDownloading,
  isDeleting,
  isExporting,
  isArchiving,
  isForceStarting,
  isBulkRetrying,
  isStoppingSeeding,
  isUpdatingProtection,
  bulkAirlockPendingAction,
  deleteSelectionBlocked,
  deleteParentDownloads,
  onDeleteParentDownloadsChange,
  showBulkForceStart,
  showBulkRetry,
  showBulkAirlockLock,
  showBulkAirlockUnlock,
  showBulkProtect,
  showBulkUnprotect,
  showBulkStopSeeding,
  showBulkArchive,
  showArchiveConfirm,
  onShowArchiveConfirm,
  onCloseArchiveConfirm,
  showDeleteConfirm,
  onShowDeleteConfirm,
  onCloseDeleteConfirm,
  showTagAssignment,
  onShowTagAssignment,
  onCloseTagAssignment,
  selectedArchivableTorrents,
  onBulkDownload,
  onBulkExport,
  onBulkArchive,
  onBulkDelete,
  onBulkForceStart,
  onBulkRetry,
  onBulkAirlock,
  onBulkProtect,
  onBulkUnprotect,
  onBulkStopSeeding,
  onClearSelection,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
  apiKey,
  allItems,
  getSelectedItems,
  setSelectedItems,
  itemTypeName,
  itemTypePlural,
}) {
  const t = useTranslations('ActionButtons');

  const handleDownloadClick = () => {
    onBulkDownload();
    if (!isDownloadPanelOpen) {
      setIsDownloadPanelOpen(true);
    }
  };

  const deleteParentFileCount = getSelectedItems().files?.size || 0;

  return (
    <div
      className="flex min-w-0 w-full flex-wrap items-center gap-1.5 xl:w-auto"
      role="toolbar"
      aria-label={t('toolbarLabel')}
    >
      <BulkActionButton
        variant="primary"
        onClick={handleDownloadClick}
        disabled={isDownloading}
        loading={isDownloading}
        icon={<Download />}
        label={isDownloading ? t('fetchingLinks') : t('downloadLinks')}
        title={t('downloadLinksTitle')}
      />

      {activeType === 'torrents' && selectedItemCount > 0 && onBulkExport && (
        <BulkActionButton
          variant="secondary"
          onClick={onBulkExport}
          disabled={isExporting}
          loading={isExporting}
          icon={<FileDown />}
          label={isExporting ? t('exporting') : t('exportSelected')}
          title={t('exportSelectedTitle')}
        />
      )}

      {showBulkForceStart && (
        <BulkActionButton
          variant="accent"
          onClick={onBulkForceStart}
          disabled={isForceStarting}
          loading={isForceStarting}
          icon={<Play className="stroke-[2.5]" />}
          label={isForceStarting ? t('forceStarting') : t('forceStart')}
          title={t('forceStartTitle')}
        />
      )}

      {showBulkRetry && (
        <BulkActionButton
          variant="accent"
          onClick={onBulkRetry}
          disabled={isBulkRetrying}
          loading={isBulkRetrying}
          icon={<Refresh />}
          label={isBulkRetrying ? t('retrying') : t('retry.label')}
          title={t('retry.title')}
        />
      )}

      {showBulkAirlockLock && (
        <BulkActionButton
          variant="secondary"
          onClick={() => onBulkAirlock(true)}
          disabled={bulkAirlockPendingAction !== null}
          loading={bulkAirlockPendingAction === 'lock'}
          icon={<Lock />}
          label={
            bulkAirlockPendingAction === 'lock' ? t('bulkAirlockLocking') : t('bulkAirlockLock')
          }
          title={t('bulkAirlockLockTitle')}
        />
      )}

      {showBulkAirlockUnlock && (
        <BulkActionButton
          variant="secondary"
          onClick={() => onBulkAirlock(false)}
          disabled={bulkAirlockPendingAction !== null}
          loading={bulkAirlockPendingAction === 'unlock'}
          icon={<Unlock />}
          label={
            bulkAirlockPendingAction === 'unlock'
              ? t('bulkAirlockUnlocking')
              : t('bulkAirlockUnlock')
          }
          title={t('bulkAirlockUnlockTitle')}
        />
      )}

      {showBulkProtect && (
        <BulkActionButton
          variant="secondary"
          onClick={onBulkProtect}
          disabled={isUpdatingProtection}
          loading={isUpdatingProtection}
          icon={<Shield />}
          label={t('bulkProtect')}
          title={t('bulkProtectTitle')}
        />
      )}

      {showBulkUnprotect && (
        <BulkActionButton
          variant="secondary"
          onClick={onBulkUnprotect}
          disabled={isUpdatingProtection}
          loading={isUpdatingProtection}
          icon={<Shield />}
          label={t('bulkUnprotect')}
          title={t('bulkUnprotectTitle')}
        />
      )}

      {showBulkStopSeeding && (
        <BulkActionButton
          variant="stop"
          onClick={onBulkStopSeeding}
          disabled={isStoppingSeeding}
          loading={isStoppingSeeding}
          icon={<Stop />}
          label={isStoppingSeeding ? t('stoppingSeeding') : t('stopSeeding')}
          title={t('stopSeedingTitle')}
        />
      )}

      {selectedItemCount > 0 && (
        <BulkActionButton
          variant="secondary"
          onClick={() => onShowTagAssignment(true)}
          icon={<Tag />}
          label={t('assignTags')}
          title={t('assignTagsTitle')}
        />
      )}

      {showBulkArchive && onBulkArchive && (
        <BulkActionButton
          variant="secondary"
          onClick={() => onShowArchiveConfirm(true)}
          disabled={isArchiving}
          loading={isArchiving}
          icon={<Archive />}
          label={isArchiving ? t('archiveConfirm.archiving') : t('archive')}
          title={t('archiveTitle')}
        />
      )}

      {(selectedItemCount > 0 || hasSelectedFiles) && (
        <BulkActionButton
          variant="danger"
          onClick={() => onShowDeleteConfirm(true)}
          disabled={isDeleting || deleteSelectionBlocked}
          loading={isDeleting}
          icon={<Delete />}
          label={isDeleting ? t('deleteConfirm.deleting') : t('deleteConfirm.confirm')}
          title={deleteSelectionBlocked ? t('deleteProtectedTitle') : t('deleteConfirm.title')}
        />
      )}

      <BulkActionButton
        variant="ghost"
        onClick={onClearSelection}
        icon={<Times />}
        label={t('clear')}
        title={t('clearTitle')}
      />

      <ActionButtonsConfirmModals
        showArchiveConfirm={showArchiveConfirm}
        onCloseArchiveConfirm={onCloseArchiveConfirm}
        onConfirmArchive={() =>
          confirmArchive({
            onClose: onCloseArchiveConfirm,
            onBulkArchive,
            selectedArchivableCount: selectedArchivableTorrents.length,
          })
        }
        isArchiving={isArchiving}
        selectedArchivableCount={selectedArchivableTorrents.length}
        showDeleteConfirm={showDeleteConfirm}
        onCloseDeleteConfirm={onCloseDeleteConfirm}
        onConfirmDelete={() =>
          confirmDelete({
            onClose: onCloseDeleteConfirm,
            onBulkDelete,
            deleteParentDownloads,
          })
        }
        isDeleting={isDeleting}
        selectedItemCount={selectedItemCount}
        deleteParentFileCount={deleteParentFileCount}
        hasSelectedFiles={hasSelectedFiles}
        deleteParentDownloads={deleteParentDownloads}
        onDeleteParentDownloadsChange={onDeleteParentDownloadsChange}
        itemTypeName={itemTypeName}
        itemTypePlural={itemTypePlural}
      />

      {showTagAssignment && (
        <TagAssignmentModal
          isOpen={showTagAssignment}
          onClose={() => onCloseTagAssignment(false)}
          downloadIds={Array.from(getSelectedItems().items || []).flatMap((selectionId) => {
            const id = findItemBySelectionId(allItems, selectionId)?.id?.toString();
            return id ? [id] : [];
          })}
          apiKey={apiKey}
          onSuccess={() => {
            setSelectedItems({ items: new Set(), files: new Map() });
          }}
        />
      )}
    </div>
  );
}
