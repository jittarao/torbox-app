import { useState, useEffect, useRef, useMemo } from 'react';
import { phEvent } from '@/utils/sa';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { Question } from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';
import TagAssignmentModal from '../../Tags/TagAssignmentModal';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';
import {
  useDownloadsSelectionStore,
  selectSelectedItemCount,
} from '@/store/downloadsSelectionStore';
import { controlTorrent } from '@/utils/uploadActions';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { isTorrentSeeding } from '../utils/statusHelpers';

export default function ActionButtons({
  setSelectedItems,
  hasSelectedFiles,
  isDownloading,
  isDeleting,
  isExporting,
  onBulkDownload,
  onBulkDelete,
  onBulkExport,
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
  const selectedItemCount = useDownloadsSelectionStore(selectSelectedItemCount);
  const getSelectedItems = () => useDownloadsSelectionStore.getState().selectedItems;
  const patchItem = useTorboxDownloadsStore((state) => state.patchItem);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isStoppingSeeding, setIsStoppingSeeding] = useState(false);
  const [deleteParentDownloads, setDeleteParentDownloads] = useState(false);
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const connectedProviders = useRef({});
  const isMobile = useIsMobile();
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

  const getDownloadButtonText = () => {
    if (isDownloading) return t('fetchingLinks');
    return isMobile ? t('downloadLinksMobile') : t('downloadLinks');
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
    <div className="flex min-w-0 w-full flex-wrap items-center gap-2 lg:w-auto">
      <button
        type="button"
        onClick={handleDownloadClick}
        disabled={isDownloading}
        className="bg-accent text-white text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-accent/90 
        disabled:opacity-50 transition-colors"
      >
        {getDownloadButtonText()}
      </button>

      {/* Bulk Export button - only for torrents */}
      {activeType === 'torrents' && selectedItemCount > 0 && onBulkExport && (
        <button
          type="button"
          onClick={handleBulkExport}
          disabled={isExporting}
          className="bg-primary hover:bg-primary-hover text-white text-xs lg:text-sm px-4 py-1.5 rounded
          disabled:opacity-50 transition-colors"
        >
          {isExporting ? t('exporting') : t('exportSelected')}
        </button>
      )}

      {showBulkStopSeeding && (
        <button
          type="button"
          onClick={handleBulkStopSeeding}
          disabled={isStoppingSeeding}
          className="border border-border dark:border-border-dark bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark disabled:opacity-50 transition-colors"
        >
          {isStoppingSeeding ? t('stoppingSeeding') : t('stopSeeding')}
        </button>
      )}

      {/* Bulk Tag Assignment button */}
      {selectedItemCount > 0 && (
        <button
          type="button"
          onClick={() => setShowTagAssignment(true)}
          className="border border-border dark:border-border-dark bg-surface-alt dark:bg-surface-alt-dark text-primary-text dark:text-primary-text-dark text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark 
          transition-colors"
        >
          Assign Tags
        </button>
      )}

      {/* Bulk Cloud Upload button - Temporarily hidden */}

      {(selectedItemCount > 0 || hasSelectedFiles) && (
        <>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="bg-red-500 text-white text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-red-600 
            disabled:opacity-50 transition-colors"
          >
            {isDeleting ? t('deleteConfirm.deleting') : t('deleteConfirm.confirm')}
          </button>

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-neutral-950 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg shadow-lg max-w-md">
                <h3 className="text-lg font-semibold mb-4 text-primary-text dark:text-primary-text-dark">
                  {t('deleteConfirm.title')}
                </h3>
                <p className="text-primary-text/70 dark:text-primary-text-dark/70 mb-6">
                  {t('deleteConfirm.message', {
                    count:
                      selectedItemCount +
                      (deleteParentDownloads ? getSelectedItems().files?.size : 0),
                    type: selectedItemCount === 1 ? itemTypeName : itemTypePlural,
                  })}
                </p>

                {hasSelectedFiles && (
                  <label className="flex gap-3 mb-6 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
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

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70 
                    hover:text-primary-text dark:hover:text-primary-text-dark"
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
                    className="bg-red-500 text-sm text-white px-4 py-2 rounded hover:bg-red-600 
                    disabled:opacity-50 transition-colors"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setSelectedItems({ items: new Set(), files: new Map() })}
        className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
      >
        {t('clear')}
      </button>

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
