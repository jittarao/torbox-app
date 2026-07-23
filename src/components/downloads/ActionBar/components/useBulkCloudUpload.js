import { useEffect, useRef, useMemo } from 'react';
import { phEvent } from '@/utils/sa';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';

function getProviderName(providerId) {
  const providers = {
    [INTEGRATION_TYPES.GOOGLE_DRIVE]: 'Google Drive',
    [INTEGRATION_TYPES.DROPBOX]: 'Dropbox',
    [INTEGRATION_TYPES.ONEDRIVE]: 'OneDrive',
    [INTEGRATION_TYPES.GOFILE]: 'GoFile',
    [INTEGRATION_TYPES.FICHIER]: '1Fichier',
    [INTEGRATION_TYPES.PIXELDRAIN]: 'Pixeldrain',
  };
  return providers[providerId] || providerId;
}

/** Legacy bulk cloud upload path; retained for integrations wiring. */
export function useBulkCloudUpload({
  apiKey,
  activeType,
  allItems,
  getSelectedItems,
  setSelectedItems,
  setToast,
  t,
}) {
  const connectedProviders = useRef({});
  const apiClient = useMemo(() => createApiClient(apiKey), [apiKey]);
  const cloudUploadRef = useRef(null);
  const showCloudUploadRef = useRef(false);
  const isUploadingRef = useRef(false);

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

  const handleBulkCloudUpload = async (providerId) => {
    const selectedItems = getSelectedItems();
    if (isUploadingRef.current || !selectedItems.items?.size) return;

    if (Object.keys(connectedProviders.current).length === 0) {
      setToast({
        message:
          'Please connect to a cloud provider first in the Cloud Storage Manager. Only Google Drive, Dropbox, and OneDrive support OAuth authentication.',
        type: 'info',
      });
      showCloudUploadRef.current = false;
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

  return { cloudUploadRef, handleBulkCloudUpload };
}
