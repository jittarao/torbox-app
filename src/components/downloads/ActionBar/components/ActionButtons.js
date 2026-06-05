import { useState, useEffect, useRef, useMemo } from 'react';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import {
  Archive,
  Delete,
  Download,
  FileDown,
  Play,
  Question,
  Refresh,
  Stop,
  Tag,
  Times,
} from '@/components/icons';
import BulkActionButton from './BulkActionButton';
import Tooltip from '@/components/shared/Tooltip';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';
import TagAssignmentModal from '../../Tags/TagAssignmentModal';
import ModalSheet from '@/components/shared/ModalSheet';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import {
  useDownloadsSelectionStore,
  selectSelectedItemCount,
} from '@/store/downloadsSelectionStore';
import { controlQueuedItem, controlTorrent } from '@/utils/uploadActions';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { isTorrentQueued, isTorrentSeeding } from '../utils/statusHelpers';
import { canRetryDownload, retryDownload } from '@/utils/retryDownload';
import { removeQueuedAfterForceStartBulk } from '@/store/downloadListReconcile';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';

export default function ActionButtons({
  setSelectedItems,
  hasSelectedFiles,
  isDownloading,
  isDeleting,
  isExporting,
  onBulkDownload,
  onBulkDelete,
  onBulkArchive,
  onBulkExport,
  isArchiving = false,
  itemTypeName,
  itemTypePlural,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
  activeType = 'torrents',
  apiKey,
  setToast,
  allItems = [],
}) {
  const t = useTranslations('ActionButtons');
  const tItemActions = useTranslations('ItemActions.toast');
  const { isBackendAvailable } = useDownloadsUIContext();
  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const getSelectedItems = () => useDownloadsSelectionStore.getState().selectedItems;
  const patchItem = useTorboxDownloadsStore((state) => state.patchItem);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isStoppingSeeding, setIsStoppingSeeding] = useState(false);
  const [isForceStarting, setIsForceStarting] = useState(false);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);
  const [deleteParentDownloads, setDeleteParentDownloads] = useState(false);
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const connectedProviders = useRef({});
  const apiClient = useMemo(() => createApiClient(apiKey), [apiKey]);
  const cloudUploadRef = useRef(null);
  const showCloudUploadRef = useRef(false);
  const isUploadingRef = useRef(false);

  const selectedSeedingTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds
      .map((selectionId) => findItemBySelectionId(allItems, selectionId))
      .filter(Boolean);

    if (resolved.length !== selectionIds.length) return [];

    const allSeedingTorrents = resolved.every(
      (item) =>
        resolveItemAssetType(item, activeType) === 'torrents' && isTorrentSeeding(item)
    );
    return allSeedingTorrents ? resolved : [];
  }, [activeType, allItems, hasSelectedFiles, selectedItemCount]);

  const showBulkStopSeeding = selectedSeedingTorrents.length > 0;

  const selectedQueuedTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds
      .map((selectionId) => findItemBySelectionId(allItems, selectionId))
      .filter(Boolean);

    if (resolved.length !== selectionIds.length) return [];

    const allQueuedTorrents = resolved.every(
      (item) =>
        resolveItemAssetType(item, activeType) === 'torrents' && isTorrentQueued(item)
    );
    return allQueuedTorrents ? resolved : [];
  }, [activeType, allItems, hasSelectedFiles, selectedItemCount]);

  const showBulkForceStart = selectedQueuedTorrents.length > 0;

  const selectedRetryable = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'webdl' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds
      .map((selectionId) => findItemBySelectionId(allItems, selectionId))
      .filter(Boolean);

    if (resolved.length !== selectionIds.length) return [];

    const allRetryable = resolved.every((item) => canRetryDownload(item, activeType));
    return allRetryable ? resolved : [];
  }, [activeType, allItems, hasSelectedFiles, selectedItemCount]);

  const showBulkRetry = selectedRetryable.length > 0;

  const selectedArchivableTorrents = useMemo(() => {
    if (hasSelectedFiles || selectedItemCount === 0) return [];
    if (activeType !== 'torrents' && activeType !== 'all') return [];

    const selectionIds = Array.from(getSelectedItems().items || []);
    const resolved = selectionIds
      .map((selectionId) => findItemBySelectionId(allItems, selectionId))
      .filter(Boolean);

    if (resolved.length !== selectionIds.length) return [];

    const allArchivable = resolved.every(
      (item) =>
        resolveItemAssetType(item, activeType) === 'torrents' && Boolean(item.hash)
    );
    return allArchivable ? resolved : [];
  }, [activeType, allItems, hasSelectedFiles, selectedItemCount]);

  const showBulkArchive = isBackendAvailable && selectedArchivableTorrents.length > 0;

  // Check for connected providers once per API key (not on every ActionBar re-render)
  useEffect(() => {
    if (!apiKey) {
      connectedProviders.current = {};
      return;
    }

    const checkConnectedProviders = async () => {
      try {
        const response = await apiClient.getIntegrationJobs();
        if (response && response.jobs) {
          const providers = new Set();
          response.jobs.forEach((job) => {
            if (job.provider) {
              providers.add(job.provider);
            }
          });

          const connected = {};
          providers.forEach((provider) => {
            connected[provider] = true;
          });
          connectedProviders.current = connected;
        }
      } catch {
        // Expected when integration is not available
      }
    };

    checkConnectedProviders();
  }, [apiKey, apiClient]);

  // Close cloud upload dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cloudUploadRef.current && !cloudUploadRef.current.contains(event.target)) {
        showCloudUploadRef.current = false;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDownloadClick = () => {
    onBulkDownload();
    if (!isDownloadPanelOpen) {
      setIsDownloadPanelOpen(true);
    }
    phEvent('download_items');
  };

  const handleBulkExport = () => {
    if (onBulkExport) {
      onBulkExport();
    }
    phEvent('bulk_export_torrents');
  };

  const handleBulkStopSeeding = async () => {
    if (isStoppingSeeding || !apiKey || selectedSeedingTorrents.length === 0) return;

    setIsStoppingSeeding(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of selectedSeedingTorrents) {
        const result = await controlTorrent(apiKey, item.id, 'stop_seeding');
        if (result?.success) {
          successCount++;
          patchItem(resolveItemAssetType(item, activeType), item.id, {
            active: false,
            download_state: 'completed',
            download_present: true,
          });
        } else {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({
          message: t('bulkSeedingStopped', { count: successCount }),
          type: 'success',
        });
        phEvent('bulk_stop_seeding', { count: successCount });
      } else if (successCount > 0) {
        setToast({
          message: t('bulkSeedingPartial', { success: successCount, failed: failCount }),
          type: 'warning',
        });
        phEvent('bulk_stop_seeding', { count: successCount, failed: failCount });
      } else {
        setToast({
          message: tItemActions('seedingStopFailed'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in bulk stop seeding:', error);
      setToast({
        message: tItemActions('seedingStopFailed'),
        type: 'error',
      });
    } finally {
      setIsStoppingSeeding(false);
    }
  };

  const handleBulkRetry = async () => {
    if (isBulkRetrying || !apiKey || selectedRetryable.length === 0) return;

    setIsBulkRetrying(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const item of selectedRetryable) {
        const result = await retryDownload(apiKey, item, activeType);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({
          message: t('bulkRetryStarted', { count: successCount }),
          type: 'success',
        });
        phEvent('bulk_retry_downloads', { count: successCount });
      } else if (successCount > 0) {
        setToast({
          message: t('bulkRetryPartial', { success: successCount, failed: failCount }),
          type: 'warning',
        });
        phEvent('bulk_retry_downloads', { count: successCount, failed: failCount });
      } else {
        setToast({
          message: tItemActions('retryFailed'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in bulk retry:', error);
      setToast({
        message: tItemActions('retryFailed'),
        type: 'error',
      });
    } finally {
      setIsBulkRetrying(false);
    }
  };

  const handleBulkForceStart = async () => {
    if (isForceStarting || !apiKey || selectedQueuedTorrents.length === 0) return;

    setIsForceStarting(true);
    let successCount = 0;
    let failCount = 0;

    const removedByType = { torrents: [], usenet: [], webdl: [] };

    try {
      for (const item of selectedQueuedTorrents) {
        const assetType = resolveItemAssetType(item, activeType);
        const result = await controlQueuedItem(apiKey, item.id, 'start', assetType);
        if (result?.success) {
          successCount++;
          removedByType[assetType].push(item.id);
        } else {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({
          message: t('bulkForceStarted', { count: successCount }),
          type: 'success',
        });
        phEvent('bulk_force_start', { count: successCount });
      } else if (successCount > 0) {
        setToast({
          message: t('bulkForceStartPartial', { success: successCount, failed: failCount }),
          type: 'warning',
        });
        phEvent('bulk_force_start', { count: successCount, failed: failCount });
      } else {
        setToast({
          message: tItemActions('downloadFailed'),
          type: 'error',
        });
      }

      if (successCount > 0) {
        removeQueuedAfterForceStartBulk(removedByType);
      }
    } catch (error) {
      console.error('Error in bulk force start:', error);
      setToast({
        message: tItemActions('downloadFailed'),
        type: 'error',
      });
    } finally {
      setIsForceStarting(false);
    }
  };

  const handleBulkCloudUpload = async (providerId) => {
    const selectedItems = getSelectedItems();
    if (isUploadingRef.current || !selectedItems.items?.size) return;

    // Check if any providers are connected
    if (Object.keys(connectedProviders.current).length === 0) {
      setToast({
        message:
          'Please connect to a cloud provider first in the Cloud Storage Manager. Only Google Drive, Dropbox, and OneDrive support OAuth authentication.',
        type: 'info',
      });
      setShowCloudUpload(false);
      return;
    }

    isUploadingRef.current = true;

    try {
      const selectedItemsArray = Array.from(selectedItems.items)
        .map((selectionId) => findItemBySelectionId(allItems, selectionId)?.id)
        .filter((id) => id != null);

      const uploadOne = async (itemId) => {
        const uploadData = {
          id: itemId,
          file_id: null,
          zip: true,
          type: activeType,
        };

        let response;
        switch (providerId) {
          case INTEGRATION_TYPES.GOOGLE_DRIVE:
            response = await apiClient.addToGoogleDrive(uploadData);
            break;
          case INTEGRATION_TYPES.DROPBOX:
            response = await apiClient.addToDropbox(uploadData);
            break;
          case INTEGRATION_TYPES.ONEDRIVE:
            response = await apiClient.addToOneDrive(uploadData);
            break;
          case INTEGRATION_TYPES.GOFILE:
            response = await apiClient.addToGofile(uploadData);
            break;
          case INTEGRATION_TYPES.FICHIER:
            response = await apiClient.addTo1Fichier(uploadData);
            break;
          case INTEGRATION_TYPES.PIXELDRAIN:
            response = await apiClient.addToPixeldrain(uploadData);
            break;
          default:
            throw new Error('Unknown provider');
        }

        return { success: !!(response && response.success) };
      };

      const results = await Promise.allSettled(selectedItemsArray.map(uploadOne));
      let successCount = 0;
      let errorCount = 0;

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.success) {
          successCount++;
        } else {
          const error = r.status === 'rejected' ? r.reason : null;
          if (
            error?.message &&
            (error.message.includes('AUTH_ERROR') ||
              error.message.includes('Provider not connected') ||
              error.message.includes('NO_AUTH') ||
              error.message.includes('Authentication required'))
          ) {
            setToast({
              message: `Please connect to ${getProviderName(providerId)} first in the Cloud Storage Manager`,
              type: 'error',
            });
            isUploadingRef.current = false;
            showCloudUploadRef.current = false;
            return;
          }
          errorCount++;
        }
      }

      if (successCount > 0) {
        setToast({
          message: t('bulkUploadSuccess', {
            count: successCount,
            provider: getProviderName(providerId),
          }),
          type: 'success',
        });
        phEvent('bulk_cloud_upload', { provider: providerId, count: successCount });
      }

      if (errorCount > 0) {
        setToast({
          message: t('bulkUploadPartial', { success: successCount, failed: errorCount }),
          type: 'warning',
        });
      }

      setSelectedItems({ items: new Set() });
    } catch (error) {
      console.error('Error in bulk cloud upload:', error);
      setToast({
        message: t('bulkUploadFailed'),
        type: 'error',
      });
    } finally {
      isUploadingRef.current = false;
      showCloudUploadRef.current = false;
    }
  };

  const getProviderName = (providerId) => {
    const providers = {
      [INTEGRATION_TYPES.GOOGLE_DRIVE]: 'Google Drive',
      [INTEGRATION_TYPES.DROPBOX]: 'Dropbox',
      [INTEGRATION_TYPES.ONEDRIVE]: 'OneDrive',
      [INTEGRATION_TYPES.GOFILE]: 'GoFile',
      [INTEGRATION_TYPES.FICHIER]: '1Fichier',
      [INTEGRATION_TYPES.PIXELDRAIN]: 'Pixeldrain',
    };
    return providers[providerId] || providerId;
  };

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
          onClick={handleBulkExport}
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
          onClick={handleBulkForceStart}
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
          onClick={handleBulkRetry}
          disabled={isBulkRetrying}
          loading={isBulkRetrying}
          icon={<Refresh />}
          label={isBulkRetrying ? t('retrying') : t('retry.label')}
          title={t('retry.title')}
        />
      )}

      {showBulkStopSeeding && (
        <BulkActionButton
          variant="stop"
          onClick={handleBulkStopSeeding}
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
          onClick={() => setShowTagAssignment(true)}
          icon={<Tag />}
          label={t('assignTags')}
          title={t('assignTagsTitle')}
        />
      )}

      {showBulkArchive && onBulkArchive && (
        <>
          <BulkActionButton
            variant="secondary"
            onClick={() => setShowArchiveConfirm(true)}
            disabled={isArchiving}
            loading={isArchiving}
            icon={<Archive />}
            label={isArchiving ? t('archiveConfirm.archiving') : t('archive')}
            title={t('archiveTitle')}
          />

          {showArchiveConfirm && (
            <ModalSheet
              open={showArchiveConfirm}
              onClose={() => setShowArchiveConfirm(false)}
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
                    count: selectedArchivableTorrents.length,
                  })}
                </p>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowArchiveConfirm(false)}
                    className="ui-btn-ghost w-full justify-center sm:w-auto"
                  >
                    {t('archiveConfirm.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArchiveConfirm(false);
                      onBulkArchive();
                      phEvent('bulk_archive', { count: selectedArchivableTorrents.length });
                    }}
                    disabled={isArchiving}
                    className="ui-btn-accent w-full justify-center sm:w-auto disabled:opacity-50"
                  >
                    {t('archiveConfirm.confirm')}
                  </button>
                </div>
              </div>
            </ModalSheet>
          )}
        </>
      )}

      {(selectedItemCount > 0 || hasSelectedFiles) && (
        <>
          <BulkActionButton
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            loading={isDeleting}
            icon={<Delete />}
            label={isDeleting ? t('deleteConfirm.deleting') : t('deleteConfirm.confirm')}
            title={t('deleteConfirm.title')}
          />

          {showDeleteConfirm && (
            <ModalSheet
              open={showDeleteConfirm}
              onClose={() => setShowDeleteConfirm(false)}
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
                    count:
                      selectedItemCount +
                      (deleteParentDownloads ? getSelectedItems().files?.size : 0),
                    type: selectedItemCount === 1 ? itemTypeName : itemTypePlural,
                  })}
                </p>

                {hasSelectedFiles && (
                  <label className="mt-4 flex gap-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                    <input
                      type="checkbox"
                      checked={deleteParentDownloads}
                      onChange={(e) => setDeleteParentDownloads(e.target.checked)}
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
                    onClick={() => setShowDeleteConfirm(false)}
                    className="ui-btn-ghost w-full justify-center sm:w-auto"
                  >
                    {t('deleteConfirm.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      onBulkDelete(deleteParentDownloads);
                      phEvent('delete_items', {
                        includeParents: deleteParentDownloads,
                      });
                    }}
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
      )}

      <BulkActionButton
        variant="ghost"
        onClick={() => setSelectedItems({ items: new Set(), files: new Map() })}
        icon={<Times />}
        label={t('clear')}
        title={t('clearTitle')}
      />

      {/* Tag Assignment Modal */}
      {showTagAssignment && (
        <TagAssignmentModal
          isOpen={showTagAssignment}
          onClose={() => setShowTagAssignment(false)}
          downloadIds={Array.from(getSelectedItems().items || [])
            .map((selectionId) => findItemBySelectionId(allItems, selectionId)?.id?.toString())
            .filter(Boolean)}
          apiKey={apiKey}
          onSuccess={() => {
            setSelectedItems({ items: new Set(), files: new Map() });
            // Tags will be refreshed automatically via useDownloadTags hook
          }}
        />
      )}
    </div>
  );
}
