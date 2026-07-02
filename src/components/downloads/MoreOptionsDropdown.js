import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  Copy,
  Delete,
  Download,
  FileDown,
  Lock,
  Refresh,
  Unlock,
  VerticalEllipsis,
} from '@/components/icons';
import Spinner from '../shared/Spinner';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import { createApiClient } from '@/utils/apiClient';
import { buildShortMagnetLink } from '@/utils/retryDownload';
import { INTEGRATION_TYPES } from '@/types/api';
import TagAssignmentModal from './Tags/TagAssignmentModal';
import ModalOverlay from '@/components/shared/ModalOverlay';

function menuButtonClass(menuVariant, tone = 'neutral') {
  if (menuVariant === 'sheet') {
    if (tone === 'accent') {
      return 'ui-mobile-more-link text-accent dark:text-accent-dark disabled:opacity-50';
    }
    if (tone === 'danger') {
      return 'ui-mobile-more-link text-red-600 dark:text-red-400 disabled:opacity-50';
    }
    return 'ui-mobile-more-link disabled:opacity-50';
  }
  if (tone === 'accent') {
    return 'flex items-center w-full px-4 py-2 text-sm text-left text-accent dark:text-accent-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark';
  }
  if (tone === 'danger') {
    return 'flex items-center w-full px-4 py-2 text-sm text-left text-red-500 dark:text-red-400 hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50';
  }
  return 'flex items-center w-full px-4 py-2 text-sm text-left text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50';
}

function menuDividerClass(menuVariant) {
  return menuVariant === 'sheet'
    ? 'my-2 mx-3 border-t border-border/50 dark:border-border-dark/50'
    : 'my-1 border-t border-border dark:border-border-dark';
}

function MenuItemButton({ menuVariant, tone, onClick, disabled, icon, children }) {
  const labelClass = menuVariant === 'sheet' ? 'min-w-0 flex-1 text-left' : 'ml-2';
  const iconWrapClass =
    menuVariant === 'sheet'
      ? 'flex size-5 shrink-0 items-center justify-center [&_svg]:size-5'
      : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={menuButtonClass(menuVariant, tone)}
    >
      {menuVariant === 'sheet' ? <span className={iconWrapClass}>{icon}</span> : icon}
      <span className={labelClass}>{children}</span>
    </button>
  );
}

function MenuItems({
  menuVariant = 'dropdown',
  activeType,
  t,
  actionT,
  isExporting,
  isReannouncing,
  isRetrying,
  isDeleting,
  showDownload,
  showRetry,
  showDelete,
  showArchive,
  showAirlock,
  airlocked,
  onDownload,
  onDelete,
  onArchive,
  onToggleAirlock,
  isArchiving,
  isAirlockUpdating,
  onCopyId,
  onCopyHash,
  onCopyShortMagnet,
  onCopyFullMagnet,
  onReannounce,
  onRetry,
  onExportTorrent,
  onCopySourceUrl,
}) {
  const items = [];

  if (showRetry && onRetry) {
    items.push(
      <MenuItemButton
        key="retry"
        menuVariant={menuVariant}
        tone="accent"
        onClick={onRetry}
        disabled={isRetrying}
        icon={isRetrying ? <Spinner size="xs" /> : <Refresh />}
      >
        {actionT('retry.label')}
      </MenuItemButton>
    );
  }

  if (showDownload && onDownload) {
    items.push(
      <MenuItemButton
        key="download"
        menuVariant={menuVariant}
        tone="accent"
        onClick={onDownload}
        icon={<Download />}
      >
        {actionT('download.label')}
      </MenuItemButton>
    );
  }

  if (showDelete && onDelete) {
    items.push(
      <MenuItemButton
        key="delete"
        menuVariant={menuVariant}
        tone="danger"
        onClick={onDelete}
        disabled={isDeleting}
        icon={isDeleting ? <Spinner size="xs" /> : <Delete />}
      >
        {actionT('delete.label')}
      </MenuItemButton>
    );
  }

  if (showArchive && onArchive) {
    items.push(
      <MenuItemButton
        key="archive"
        menuVariant={menuVariant}
        onClick={onArchive}
        disabled={isArchiving}
        icon={isArchiving ? <Spinner size="xs" /> : <Archive />}
      >
        {t('archive')}
      </MenuItemButton>
    );
  }

  if (showAirlock && onToggleAirlock) {
    items.push(
      <MenuItemButton
        key="airlock"
        menuVariant={menuVariant}
        onClick={onToggleAirlock}
        disabled={isAirlockUpdating}
        icon={isAirlockUpdating ? <Spinner size="xs" /> : airlocked ? <Unlock /> : <Lock />}
      >
        {airlocked ? t('unlockDownload') : t('lockDownload')}
      </MenuItemButton>
    );
  }

  if (items.length > 0) {
    items.push(
      <div key="primary-divider" className={menuDividerClass(menuVariant)} role="separator" />
    );
  }

  items.push(
    <MenuItemButton key="copy-id" menuVariant={menuVariant} onClick={onCopyId} icon={<Copy />}>
      {t('copyId')}
    </MenuItemButton>
  );

  items.push(
    <MenuItemButton key="copy-hash" menuVariant={menuVariant} onClick={onCopyHash} icon={<Copy />}>
      {t('copyHash')}
    </MenuItemButton>
  );

  if (activeType === 'torrents') {
    items.push(
      <MenuItemButton
        key="copy-short-magnet"
        menuVariant={menuVariant}
        onClick={onCopyShortMagnet}
        icon={<Copy />}
      >
        {t('copyShortMagnet')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="copy-full-magnet"
        menuVariant={menuVariant}
        onClick={onCopyFullMagnet}
        disabled={isExporting}
        icon={isExporting ? <Spinner size="xs" /> : <Copy />}
      >
        {t('copyFullMagnet')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="reannounce"
        menuVariant={menuVariant}
        onClick={onReannounce}
        disabled={isReannouncing}
        icon={isReannouncing ? <Spinner size="xs" /> : <Refresh />}
      >
        {t('reannounce')}
      </MenuItemButton>
    );

    items.push(
      <MenuItemButton
        key="export-torrent"
        menuVariant={menuVariant}
        onClick={onExportTorrent}
        disabled={isExporting}
        icon={isExporting ? <Spinner size="xs" /> : <FileDown />}
      >
        {t('exportTorrent')}
      </MenuItemButton>
    );
  }

  if (activeType === 'webdl') {
    items.push(
      <MenuItemButton
        key="copy-source-url"
        menuVariant={menuVariant}
        onClick={onCopySourceUrl}
        icon={<Copy />}
      >
        {t('copySourceUrl')}
      </MenuItemButton>
    );
  }

  if (menuVariant === 'sheet') {
    return (
      <ul className="w-full space-y-0.5 px-2 py-1">
        {items.map((node) => (
          <li key={node.key} className="w-full">
            {node}
          </li>
        ))}
      </ul>
    );
  }

  return items;
}

export default function MoreOptionsDropdown({
  item,
  apiKey,
  setToast,
  activeType = 'torrents',
  showDownload = false,
  onDownload,
  showDelete = false,
  onDelete,
  isDeleting = false,
  showArchive = false,
  onArchive,
  isArchiving = false,
  showRetry = false,
  onRetry,
  isRetrying = false,
  showAirlock = false,
  airlocked = false,
  onToggleAirlock,
  isAirlockUpdating = false,
  compact = false,
  mobileBar = false,
}) {
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
  const actionT = useTranslations('ItemActionButtons');
  const filtersT = useTranslations('DownloadsFilters');
  const apiClient = useMemo(() => createApiClient(apiKey), [apiKey]);

  useEffect(() => {
    if (!mobileBar || !isMenuOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileBar, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Close menu when clicking outside and handle window resize
  useEffect(() => {
    if (mobileBar) return;

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
  }, [isMenuOpen, mobileBar]);

  // Calculate menu position when it opens
  const toggleMenu = (e) => {
    e.stopPropagation();

    if (mobileBar) {
      setIsMenuOpen((open) => !open);
      return;
    }

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

    setIsMenuOpen((open) => !open);
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
    const magnetLink = buildShortMagnetLink({ hash: item.hash, name: item.name });
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
      const data = await response.json().catch(() => null);

      if (data?.success && data.data) {
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

  const menuItemsElement = (
    <MenuItems
      menuVariant={mobileBar ? 'sheet' : 'dropdown'}
      activeType={activeType}
      t={t}
      actionT={actionT}
      isExporting={isExporting}
      isReannouncing={isReannouncing}
      isRetrying={isRetrying}
      isDeleting={isDeleting}
      showDownload={showDownload}
      showRetry={showRetry}
      showDelete={showDelete}
      showArchive={showArchive}
      showAirlock={showAirlock}
      airlocked={airlocked}
      onArchive={
        onArchive
          ? (e) => {
              e.stopPropagation();
              onArchive();
              setIsMenuOpen(false);
            }
          : undefined
      }
      isArchiving={isArchiving}
      onToggleAirlock={
        onToggleAirlock
          ? (e) => {
              e.stopPropagation();
              onToggleAirlock();
              setIsMenuOpen(false);
            }
          : undefined
      }
      isAirlockUpdating={isAirlockUpdating}
      onDownload={
        onDownload
          ? (e) => {
              e.stopPropagation();
              onDownload();
              setIsMenuOpen(false);
            }
          : undefined
      }
      onDelete={
        onDelete
          ? (e) => {
              e.stopPropagation();
              onDelete(e);
              setIsMenuOpen(false);
            }
          : undefined
      }
      onCopyId={handleCopyId}
      onCopyHash={handleCopyHash}
      onCopyShortMagnet={handleCopyShortMagnet}
      onCopyFullMagnet={handleCopyFullMagnet}
      onReannounce={handleReannounce}
      onRetry={
        onRetry
          ? (e) => {
              e.stopPropagation();
              onRetry();
              setIsMenuOpen(false);
            }
          : undefined
      }
      onExportTorrent={handleExportTorrent}
      onCopySourceUrl={handleCopySourceUrl}
    />
  );

  return (
    <div
      className={mobileBar ? 'ml-auto shrink-0' : 'relative'}
      ref={mobileBar ? undefined : menuRef}
    >
      <button
        type="button"
        ref={buttonRef}
        onClick={toggleMenu}
        className={
          mobileBar
            ? 'ui-header-icon-btn !h-11 !w-11 !min-w-11 shrink-0 touch-manipulation'
            : `${
                compact ? 'p-1 [&_svg]:size-4' : 'p-1.5'
              } rounded-full text-primary-text/70 dark:text-primary-text-dark/70 hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors`
        }
        title={t('title')}
        aria-label={t('label')}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        <VerticalEllipsis className={mobileBar ? 'size-5' : undefined} />
      </button>

      {isMenuOpen && isMounted && mobileBar && (
        <ModalOverlay
          open={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          closeLabel={filtersT('close')}
        >
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            className="ui-bottom-sheet fixed bottom-0 left-0 right-0 z-[1] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-0 border-t border-border/60 bg-surface shadow-2xl dark:border-border-dark/60 dark:bg-surface-dark"
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5 dark:border-border-dark/40">
              <h2 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark">
                {t('title')}
              </h2>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="ui-header-icon-btn shrink-0"
                aria-label={filtersT('close')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="size-5"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-1">
              {menuItemsElement}
            </div>
          </div>
        </ModalOverlay>
      )}

      {isMenuOpen &&
        isMounted &&
        !mobileBar &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-48 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <div className="py-1">{menuItemsElement}</div>
          </div>,
          document.body
        )}

      {/* Tag Assignment Modal */}
      <TagAssignmentModal
        isOpen={showTagAssignment}
        onClose={() => setShowTagAssignment(false)}
        downloadIds={[String(item.id)]}
        apiKey={apiKey}
        onSuccess={() => {
          // Tags will be refreshed automatically via useDownloadTags hook
        }}
      />
    </div>
  );
}
