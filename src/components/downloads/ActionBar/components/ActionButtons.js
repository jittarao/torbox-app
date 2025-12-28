import { useState, useEffect, useRef } from 'react';
import { phEvent } from '@/utils/sa';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';

export default function ActionButtons({
  selectedItems,
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
}) {
  const t = useTranslations('ActionButtons');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteParentDownloads, setDeleteParentDownloads] = useState(false);
  const [showCloudUpload, setShowCloudUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState({});
  const isMobile = useIsMobile();
  const apiClient = createApiClient(apiKey);
  const cloudUploadRef = useRef(null);

  // Check for connected providers on mount
  useEffect(() => {
    const checkConnectedProviders = async () => {
      try {
        const response = await apiClient.getIntegrationJobs();
        if (response && response.jobs) {
          // Extract unique provider types from active jobs
          const providers = new Set();
          response.jobs.forEach(job => {
            if (job.provider) {
              providers.add(job.provider);
            }
          });
          
          const connected = {};
          providers.forEach(provider => {
            connected[provider] = true;
          });
          setConnectedProviders(connected);
        }
      } catch (error) {
        console.log('No connected providers found or integration not available');
        // Don't show error toast for this as it's expected when integration is not available
      }
    };

    if (apiKey) {
      checkConnectedProviders();
    }
  }, [apiKey]);

  // Close cloud upload dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cloudUploadRef.current && !cloudUploadRef.current.contains(event.target)) {
        setShowCloudUpload(false);
      }
    };

    if (showCloudUpload) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCloudUpload]);

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

  const handleBulkCloudUpload = async (providerId) => {
    if (isUploading || !selectedItems.items?.size) return;
    
    // Check if any providers are connected
    if (Object.keys(connectedProviders).length === 0) {
      setToast({
        message: 'Please connect to a cloud provider first in the Cloud Storage Manager. Only Google Drive, Dropbox, and OneDrive support OAuth authentication.',
        type: 'info',
      });
      setShowCloudUpload(false);
      return;
    }
    
    setIsUploading(true);
    
    try {
      const selectedItemsArray = Array.from(selectedItems.items);
      let successCount = 0;
      let errorCount = 0;

      for (const itemId of selectedItemsArray) {
        try {
          const uploadData = {
            id: itemId,
            file_id: null, // Will upload as zip for bulk operations
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

          if (response && response.success) {
            successCount++;
          } else {
            console.error(`Upload failed for item ${itemId}:`, response);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error uploading item ${itemId}:`, error);
          
          // Check if it's an authentication error
          if (error.message && (error.message.includes('AUTH_ERROR') || error.message.includes('Provider not connected'))) {
            setToast({
              message: `Please connect to ${getProviderName(providerId)} first in the Cloud Storage Manager`,
              type: 'error',
            });
            setIsUploading(false);
            setShowCloudUpload(false);
            return;
          }
          
          // Check for other specific error types
          if (error.message && (error.message.includes('NO_AUTH') || error.message.includes('Authentication required'))) {
            setToast({
              message: `Please connect to ${getProviderName(providerId)} first in the Cloud Storage Manager`,
              type: 'error',
            });
            setIsUploading(false);
            setShowCloudUpload(false);
            return;
          }
          
          errorCount++;
        }
      }

      if (successCount > 0) {
        setToast({
          message: t('bulkUploadSuccess', { count: successCount, provider: getProviderName(providerId) }),
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
      setIsUploading(false);
      setShowCloudUpload(false);
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
    <div className="flex gap-4 items-center">
      <button
        onClick={handleDownloadClick}
        disabled={isDownloading}
        className="bg-accent text-white text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-accent/90 
        disabled:opacity-50 transition-colors"
      >
        {getDownloadButtonText()}
      </button>

      {/* Bulk Export button - only for torrents */}
      {activeType === 'torrents' && selectedItems.items?.size > 0 && onBulkExport && (
        <button
          onClick={handleBulkExport}
          disabled={isExporting}
          className="bg-blue-500 text-white text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-blue-600 
          disabled:opacity-50 transition-colors"
        >
          {isExporting ? t('exporting') : t('exportSelected')}
        </button>
      )}

      {/* Bulk Cloud Upload button - Temporarily hidden */}

      {(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
        <>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            className="bg-red-500 text-white text-xs lg:text-sm px-4 py-1.5 rounded hover:bg-red-600 
            disabled:opacity-50 transition-colors"
          >
            {isDeleting
              ? t('deleteConfirm.deleting')
              : t('deleteConfirm.confirm')}
          </button>

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg shadow-lg max-w-md">
                <h3 className="text-lg font-semibold mb-4 text-primary-text dark:text-primary-text-dark">
                  {t('deleteConfirm.title')}
                </h3>
                <p className="text-primary-text/70 dark:text-primary-text-dark/70 mb-6">
                  {t('deleteConfirm.message', {
                    count:
                      selectedItems.items?.size +
                      (deleteParentDownloads ? selectedItems.files?.size : 0),
                    type:
                      selectedItems.items?.size === 1
                        ? itemTypeName
                        : itemTypePlural,
                  })}
                </p>

                {hasSelectedFiles() && (
                  <label className="flex gap-3 mb-6 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                    <input
                      type="checkbox"
                      checked={deleteParentDownloads}
                      onChange={(e) =>
                        setDeleteParentDownloads(e.target.checked)
                      }
                      className="rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    {t('deleteConfirm.includeParentDownloads')}
                    <Tooltip
                      content={t('deleteConfirm.includeParentDownloadsTooltip')}
                    >
                      <Icons.Question />
                    </Tooltip>
                  </label>
                )}

                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70 
                    hover:text-primary-text dark:hover:text-primary-text-dark"
                  >
                    {t('deleteConfirm.cancel')}
                  </button>
                  <button
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
        onClick={() => setSelectedItems({ items: new Set(), files: new Map() })}
        className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
      >
        {t('clear')}
      </button>
    </div>
  );
}
