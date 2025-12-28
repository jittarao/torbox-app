import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icons from '@/components/icons';
import Spinner from '../shared/Spinner';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import { createApiClient } from '@/utils/apiClient';
import { INTEGRATION_TYPES } from '@/types/api';

export default function MoreOptionsDropdown({
  item,
  apiKey,
  setToast,
  isMobile = false,
  activeType = 'torrents',
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isReannouncing, setIsReannouncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // const [showCloudUpload, setShowCloudUpload] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const t = useTranslations('MoreOptionsDropdown');
  const apiClient = createApiClient(apiKey);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

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
      const response = await fetch(
        `/api/torrents/export?torrent_id=${item.id}&type=magnet`,
        {
          headers: {
            'x-api-key': apiKey,
          },
        },
      );
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
      const response = await fetch(
        `/api/torrents/export?torrent_id=${item.id}&type=torrent`,
        {
          headers: {
            'x-api-key': apiKey,
          },
        },
      );

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
    if (isUploading) return;
    setIsUploading(true);
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
      if (error.message && (error.message.includes('AUTH_ERROR') || error.message.includes('NO_AUTH') || error.message.includes('Authentication required') || error.message.includes('Provider not connected'))) {
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
      setIsUploading(false);
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

  const renderMenuItems = () => {
    const items = [];

    // Common options for all types
    items.push(
      <button
        key="copy-id"
        onClick={handleCopyId}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        <Icons.Copy />
        <span className="ml-2">{t('copyId')}</span>
      </button>,
    );

    items.push(
      <button
        key="copy-hash"
        onClick={handleCopyHash}
        className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        <Icons.Copy />
        <span className="ml-2">{t('copyHash')}</span>
      </button>,
    );

    // Cloud upload option - HIDDEN FOR NOW
    // items.push(
    //   <button
    //     key="cloud-upload"
    //     onClick={() => {
    //       setToast({
    //         message: 'Please connect to a cloud provider first in the Cloud Storage Manager',
    //         type: 'info',
    //       });
    //       setShowCloudUpload(false);
    //       setIsMenuOpen(false);
    //     }}
    //     className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
    //   >
    //     <Icons.Cloud />
    //     <span className="ml-2">{t('uploadToCloud')}</span>
    //     <Icons.ChevronDown className={`ml-auto w-4 h-4 transition-transform ${showCloudUpload ? 'rotate-180' : ''}`} />
    //   </button>,
    // );

    // Cloud upload submenu - HIDDEN FOR NOW
    // if (showCloudUpload) {
    //   // Add help message
    //   items.push(
    //     <div
    //       key="cloud-upload-help"
    //       className="px-4 py-2 text-xs text-primary-text/60 dark:text-primary-text-dark/60 border-b border-border dark:border-border-dark"
    //     >
    //       Connect to providers in Cloud Storage Manager first
    //     </div>,
    //   );

    //   const providers = [
    //     { id: INTEGRATION_TYPES.GOOGLE_DRIVE, name: 'Google Drive', icon: Icons.GoogleDrive },
    //     { id: INTEGRATION_TYPES.DROPBOX, name: 'Dropbox', icon: Icons.Dropbox },
    //     { id: INTEGRATION_TYPES.ONEDRIVE, name: 'OneDrive', icon: Icons.OneDrive },
    //     { id: INTEGRATION_TYPES.GOFILE, name: 'GoFile', icon: Icons.GoFile },
    //     { id: INTEGRATION_TYPES.FICHIER, name: '1Fichier', icon: Icons.Fichier },
    //     { id: INTEGRATION_TYPES.PIXELDRAIN, name: 'Pixeldrain', icon: Icons.Pixeldrain },
    //   ];

    //   providers.forEach((provider) => {
    //     items.push(
    //       <button
    //         key={`upload-${provider.id}`}
    //         onClick={() => handleCloudUpload(provider.id)}
    //         disabled={isUploading}
    //         className="flex items-center w-full px-4 py-2 pl-8 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
    //       >
    //         {isUploading ? <Spinner size="xs" /> : <provider.icon className="w-4 h-4" />}
    //         <span className="ml-2">{provider.name}</span>
    //       </button>,
    //     );
    //   });
    // }

    // Torrent-specific options
    if (activeType === 'torrents') {
      items.push(
        <button
          key="copy-short-magnet"
          onClick={handleCopyShortMagnet}
          className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
        >
          <Icons.Copy />
          <span className="ml-2">{t('copyShortMagnet')}</span>
        </button>,
      );

      if (item.active) {
        items.push(
          <button
            key="copy-full-magnet"
            onClick={handleCopyFullMagnet}
            disabled={isExporting}
            className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
          >
            {isExporting ? <Spinner size="xs" /> : <Icons.Copy />}
            <span className="ml-2">{t('copyFullMagnet')}</span>
          </button>,
        );

        items.push(
          <button
            key="reannounce"
            onClick={handleReannounce}
            disabled={isReannouncing}
            className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
          >
            {isReannouncing ? <Spinner size="xs" /> : <Icons.Refresh />}
            <span className="ml-2">{t('reannounce')}</span>
          </button>,
        );
      }

      items.push(
        <button
          key="export-torrent"
          onClick={handleExportTorrent}
          disabled={isExporting}
          className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
        >
          {isExporting ? <Spinner size="xs" /> : <Icons.Download />}
          <span className="ml-2">{t('exportTorrent')}</span>
        </button>,
      );
    }

    // WebDL-specific options
    if (activeType === 'webdl') {
      items.push(
        <button
          key="copy-source-url"
          onClick={handleCopySourceUrl}
          className="flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
        >
          <Icons.Copy />
          <span className="ml-2">{t('copySourceUrl')}</span>
        </button>,
      );
    }

    return items;
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-1.5 rounded-full text-primary-text/70 dark:text-primary-text-dark/70 
          hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors
          ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
        title={t('title')}
      >
        <Icons.VerticalEllipsis />
        {isMobile && <span className="ml-2 text-xs">{t('label')}</span>}
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
            <div className="py-1">{renderMenuItems()}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
