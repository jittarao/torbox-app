import { useState, useRef } from 'react';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { phEvent } from '@/utils/sa';
import { buildShortMagnetLink } from '@/utils/retryDownload';
import { INTEGRATION_TYPES } from '@/types/api';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getItemFileCount, resolveItemFiles } from '@/utils/downloadEntityFiles';

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

export function useMoreOptionsActions({ item, apiKey, activeType, setToast, t, apiClient }) {
  const [isExporting, setIsExporting] = useState(false);
  const [isReannouncing, setIsReannouncing] = useState(false);
  const isUploadingRef = useRef(false);

  const copyToClipboard = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({
        message: successMessage,
        type: 'success',
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      setToast({
        message: t('toast.clipboardError'),
        type: 'error',
      });
    }
  };

  const handleCopyId = (setIsMenuOpen) => (e) => {
    e.stopPropagation();
    copyToClipboard(item.id, t('toast.idCopied'));
    phEvent('copy_item_id');
    setIsMenuOpen(false);
  };

  const handleCopyHash = (setIsMenuOpen) => (e) => {
    e.stopPropagation();
    if (!item.hash) {
      setToast({
        message: t('toast.hashNotAvailable'),
        type: 'error',
      });
      return;
    }
    copyToClipboard(item.hash, t('toast.hashCopied'));
    phEvent('copy_item_hash');
    setIsMenuOpen(false);
  };

  const handleCopyShortMagnet = (setIsMenuOpen) => (e) => {
    e.stopPropagation();
    if (!item.hash) {
      setToast({
        message: t('toast.hashNotAvailable'),
        type: 'error',
      });
      return;
    }
    const magnetLink = buildShortMagnetLink({ hash: item.hash, name: item.name });
    copyToClipboard(magnetLink, t('toast.shortMagnetCopied'));
    phEvent('copy_short_magnet');
    setIsMenuOpen(false);
  };

  const handleCopyFullMagnet = (setIsMenuOpen) => async (e) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/torrents/export?torrent_id=${item.id}&type=magnet`, {
        headers: {
          'x-api-key': apiKey,
        },
      });
      const { ok: responseOk, data } = await readJsonFromResponse(response);

      if (responseOk && data?.success && data.data) {
        await copyToClipboard(data.data, t('toast.fullMagnetCopied'));
        setToast({
          message: t('toast.exportMagnetSuccess'),
          type: 'success',
        });
        phEvent('copy_full_magnet');
      } else {
        throw new Error(data?.error || data?.detail || t('toast.exportMagnetFailed'));
      }
    } catch (error) {
      console.error('Error getting magnet link:', error);
      setToast({
        message: t('toast.exportMagnetFailed'),
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  const handleExportTorrent = (setIsMenuOpen) => async (e) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/torrents/export?torrent_id=${item.id}&type=torrent`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.name || item.id}.torrent`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setToast({
          message: t('toast.exportTorrentSuccess'),
          type: 'success',
        });
        phEvent('export_torrent_file');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.detail || t('toast.exportTorrentFailed'));
      }
    } catch (error) {
      console.error('Error exporting torrent:', error);
      setToast({
        message: t('toast.exportTorrentFailed'),
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  const handleCopySourceUrl = (setIsMenuOpen) => (e) => {
    e.stopPropagation();
    if (!item.original_url) {
      setToast({
        message: t('toast.sourceUrlNotAvailable'),
        type: 'error',
      });
      return;
    }
    copyToClipboard(item.original_url, t('toast.sourceUrlCopied'));
    phEvent('copy_original_url');
    setIsMenuOpen(false);
  };

  const handleReannounce = (setIsMenuOpen) => async (e) => {
    e.stopPropagation();
    if (isReannouncing) return;
    setIsReannouncing(true);
    try {
      const response = await fetch('/api/torrents/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          torrent_id: item.id,
          operation: 'reannounce',
        }),
      });

      const { ok: responseOk, data } = await readJsonFromResponse(response);
      if (responseOk && data.success) {
        setToast({
          message: t('toast.reannounceSuccess'),
          type: 'success',
        });
        phEvent('reannounce_torrent');
      } else {
        throw new Error(data.error || t('toast.reannounceFailed'));
      }
    } catch (error) {
      console.error('Error reannouncing torrent:', error);
      setToast({
        message: `Error: ${error.message}`,
        type: 'error',
      });
    } finally {
      setIsReannouncing(false);
      setIsMenuOpen(false);
    }
  };

  const handleCloudUpload = (setIsMenuOpen) => async (providerId) => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    try {
      const files = resolveItemFiles(item, useTorboxDownloadsStore.getState().filesByEntityKey);
      const uploadData = {
        id: item.id,
        file_id: files[0]?.id || null,
        zip: getItemFileCount(item) > 1,
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
        setToast({
          message: t('toast.uploadStarted'),
          type: 'success',
        });
        phEvent('cloud_upload_started', { provider: providerId });
      } else {
        throw new Error(response?.error || response?.detail || t('toast.uploadFailed'));
      }
    } catch (error) {
      console.error('Error uploading to cloud:', error);

      if (
        error.message &&
        (error.message.includes('AUTH_ERROR') ||
          error.message.includes('NO_AUTH') ||
          error.message.includes('Authentication required') ||
          error.message.includes('Provider not connected'))
      ) {
        setToast({
          message: `Please connect to ${getProviderName(providerId)} first in the Cloud Storage Manager`,
          type: 'error',
        });
      } else {
        setToast({
          message: t('toast.uploadFailed'),
          type: 'error',
        });
      }
    } finally {
      isUploadingRef.current = false;
      setIsMenuOpen(false);
    }
  };

  void handleCloudUpload;

  return {
    isExporting,
    isReannouncing,
    handleCopyId,
    handleCopyHash,
    handleCopyShortMagnet,
    handleCopyFullMagnet,
    handleExportTorrent,
    handleCopySourceUrl,
    handleReannounce,
  };
}
