import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Icons from '@/components/icons';
import Spinner from '../shared/Spinner';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';
import TagAssignmentModal from './Tags/TagAssignmentModal';

function MenuItems({
  activeType,
  t,
  isExporting,
  isReannouncing,
  onCopyId,
  onCopyHash,
  onCopyShortMagnet,
  onCopyFullMagnet,
  onReannounce,
  onExportTorrent,
  onCopySourceUrl,
}) {
  const items = [];

  items.push(
    <button
      type="button"
      key="copy-id"
      onClick={onCopyId}
      className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
    >
      <Icons.Copy />
      <span className="ml-2">{t('copyId')}</span>
    </button>
  );

  items.push(
    <button
      type="button"
      key="copy-hash"
      onClick={onCopyHash}
      className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
    >
      <Icons.Copy />
      <span className="ml-2">{t('copyHash')}</span>
    </button>
  );

  if (activeType === 'torrents') {
    items.push(
      <button
        type="button"
        key="copy-short-magnet"
        onClick={onCopyShortMagnet}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        <Icons.Copy />
        <span className="ml-2">{t('copyShortMagnet')}</span>
      </button>
    );

    items.push(
      <button
        type="button"
        key="copy-full-magnet"
        onClick={onCopyFullMagnet}
        disabled={isExporting}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
      >
        {isExporting ? <Spinner size="xs" /> : <Icons.Copy />}
        <span className="ml-2">{t('copyFullMagnet')}</span>
      </button>
    );

    items.push(
      <button
        type="button"
        key="reannounce"
        onClick={onReannounce}
        disabled={isReannouncing}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
      >
        {isReannouncing ? <Spinner size="xs" /> : <Icons.Refresh />}
        <span className="ml-2">{t('reannounce')}</span>
      </button>
    );

    items.push(
      <button
        type="button"
        key="export-torrent"
        onClick={onExportTorrent}
        disabled={isExporting}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
      >
        {isExporting ? <Spinner size="xs" /> : <Icons.Download />}
        <span className="ml-2">{t('exportTorrent')}</span>
      </button>
    );
  }

  if (activeType === 'webdl') {
    items.push(
      <button
        type="button"
        key="copy-source-url"
        onClick={onCopySourceUrl}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        <Icons.Copy />
        <span className="ml-2">{t('copySourceUrl')}</span>
      </button>
    );
  }

  return items;
}

export default function MoreOptionsDropdown({ item, apiKey, setToast, activeType = 'torrents' }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isReannouncing, setIsReannouncing] = useState(false);
  const [showTagAssignment, setShowTagAssignment] = useState(false);
  const isUploadingRef = useRef(false);
  // const [showCloudUpload, setShowCloudUpload] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const t = useTranslations('MoreOptionsDropdown');
  const apiClient = createApiClient(apiKey);

  // Close menu when clicking outside and handle window resize
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMenuOpen &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    const handleScroll = () => {
      if (isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isMenuOpen]);

  // Calculate menu position when it opens
  const toggleMenu = (e) => {
    e.stopPropagation();

    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192; // w-48 = 12rem = 192px
      const menuHeight = 200; // Approximate height of the menu

      // Calculate available space in all directions
      const spaceOnRight = window.innerWidth - rect.right;
      const spaceOnLeft = rect.left;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Determine horizontal position
      let left;
      if (spaceOnRight >= menuWidth) {
        // Enough space on the right
        left = rect.right;
      } else if (spaceOnLeft >= menuWidth) {
        // Enough space on the left
        left = rect.left - menuWidth;
      } else {
        // Not enough space on either side, position to avoid overflow
        left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.left));
      }

      // Determine vertical position
      let top;
      if (spaceBelow >= menuHeight) {
        // Enough space below
        top = rect.bottom;
      } else if (spaceAbove >= menuHeight) {
        // Enough space above
        top = rect.top - menuHeight;
      } else {
        // Not enough space above or below, position to avoid overflow
        top = Math.max(8, Math.min(window.innerHeight - menuHeight - 8, rect.bottom));
      }

      setMenuPosition({ top, left });
    }

    setIsMenuOpen(!isMenuOpen);
  };

  // Copy text to clipboard
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

  // Copy ID to clipboard
  const handleCopyId = (e) => {
    e.stopPropagation();
    copyToClipboard(item.id, t('toast.idCopied'));
    phEvent('copy_item_id');
    setIsMenuOpen(false);
  };

  // Copy Hash to clipboard
  const handleCopyHash = (e) => {
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

  // Copy Short Magnet to clipboard
  const handleCopyShortMagnet = (e) => {
    e.stopPropagation();
    if (!item.hash) {
      setToast({
        message: t('toast.hashNotAvailable'),
        type: 'error',
      });
      return;
    }
    const encodedName = encodeURIComponent(item.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${item.hash}&dn=${encodedName}`;
    copyToClipboard(magnetLink, t('toast.shortMagnetCopied'));
    phEvent('copy_short_magnet');
    setIsMenuOpen(false);
  };

  // Copy Full Magnet to clipboard
  const handleCopyFullMagnet = async (e) => {
    e.stopPropagation();
    if (isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/torrents/export?torrent_id=${item.id}&type=magnet`, {
        headers: {
          'x-api-key': apiKey,
        },
      });
      const data = await response.json();

      if (data.success && data.data) {
        await copyToClipboard(data.data, t('toast.fullMagnetCopied'));
        setToast({
          message: t('toast.exportMagnetSuccess'),
          type: 'success',
        });
        phEvent('copy_full_magnet');
      } else {
        throw new Error(data.error || data.detail || t('toast.exportMagnetFailed'));
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

  // Export .torrent file
  const handleExportTorrent = async (e) => {
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
        // Create a blob from the response and download it
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

  // Copy Source URL to clipboard
  const handleCopySourceUrl = (e) => {
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

  // Handle reannounce
  const handleReannounce = async (e) => {
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

      const data = await response.json();
      if (data.success) {
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

  // Handle cloud upload
  const handleCloudUpload = async (providerId) => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;
    try {
      const uploadData = {
        id: item.id,
        file_id: item.files?.[0]?.id || null,
        zip: item.files?.length > 1,
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

      // Check if it's an authentication error
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
      // setShowCloudUpload(false);
      setIsMenuOpen(false);
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
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1.5 rounded-full text-primary-text/70 dark:text-primary-text-dark/70 hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
        title={t('title')}
        aria-label={t('label')}
      >
        <Icons.VerticalEllipsis />
      </button>

      {isMenuOpen &&
        isMounted &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-48 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <div className="py-1">
              <MenuItems
                activeType={activeType}
                t={t}
                isExporting={isExporting}
                isReannouncing={isReannouncing}
                onCopyId={handleCopyId}
                onCopyHash={handleCopyHash}
                onCopyShortMagnet={handleCopyShortMagnet}
                onCopyFullMagnet={handleCopyFullMagnet}
                onReannounce={handleReannounce}
                onExportTorrent={handleExportTorrent}
                onCopySourceUrl={handleCopySourceUrl}
              />
            </div>
          </div>,
          document.body
        )}

      {/* Tag Assignment Modal */}
      <TagAssignmentModal
        isOpen={showTagAssignment}
        onClose={() => setShowTagAssignment(false)}
        downloadIds={[item.id]}
        apiKey={apiKey}
        onSuccess={() => {
          // Tags will be refreshed automatically via useDownloadTags hook
        }}
      />
    </div>
  );
}
