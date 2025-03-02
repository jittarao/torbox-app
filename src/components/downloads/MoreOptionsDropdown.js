import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '@/components/constants';
import Spinner from '../shared/Spinner';
import { phEvent } from '@/utils/sa';

export default function MoreOptionsDropdown({
  item,
  apiKey,
  setToast,
  isMobile = false,
  activeType = 'torrents',
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isReannouncing, setIsReannouncing] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Close menu when clicking outside
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Calculate menu position when it opens
  const toggleMenu = (e) => {
    e.stopPropagation();

    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom,
        right: window.innerWidth - rect.right,
      });
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
        message: 'Failed to copy to clipboard',
        type: 'error',
      });
    }
  };

  // Copy ID to clipboard
  const handleCopyId = () => {
    copyToClipboard(item.id, 'ID copied to clipboard');
    phEvent('copy_item_id');
    setIsMenuOpen(false);
  };

  // Copy Hash to clipboard
  const handleCopyHash = () => {
    if (!item.hash) {
      setToast({
        message: 'Hash not available',
        type: 'error',
      });
      return;
    }
    copyToClipboard(item.hash, 'Hash copied to clipboard');
    phEvent('copy_item_hash');
    setIsMenuOpen(false);
  };

  // Copy Short Magnet to clipboard
  const handleCopyShortMagnet = () => {
    if (!item.hash) {
      setToast({
        message: 'Hash not available',
        type: 'error',
      });
      return;
    }
    const encodedName = encodeURIComponent(item.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${item.hash}&dn=${encodedName}`;
    copyToClipboard(magnetLink, 'Short magnet link copied to clipboard');
    phEvent('copy_short_magnet');
    setIsMenuOpen(false);
  };

  // Copy Full Magnet to clipboard
  const handleCopyFullMagnet = async () => {
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
        await copyToClipboard(
          data.data,
          'Full magnet link copied to clipboard',
        );
        phEvent('copy_full_magnet');
      } else {
        throw new Error(data.error || 'Failed to get magnet link');
      }
    } catch (error) {
      console.error('Error getting magnet link:', error);
      setToast({
        message: `Error: ${error.message}`,
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  // Export .torrent file
  const handleExportTorrent = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      window.open(
        `/api/torrents/export?torrent_id=${item.id}&type=torrent&api_key=${apiKey}`,
        '_blank',
      );
      phEvent('export_torrent_file');
    } catch (error) {
      console.error('Error exporting torrent:', error);
      setToast({
        message: `Error: ${error.message}`,
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setIsMenuOpen(false);
    }
  };

  // Copy Source URL to clipboard
  const handleCopySourceUrl = () => {
    if (!item.original_url) {
      setToast({
        message: 'Source URL not available',
        type: 'error',
      });
      return;
    }
    copyToClipboard(item.original_url, 'Source URL copied to clipboard');
    phEvent('copy_original_url');
    setIsMenuOpen(false);
  };

  // Handle reannounce
  const handleReannounce = async () => {
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
          message: 'Torrent reannounced successfully',
          type: 'success',
        });
        phEvent('reannounce_torrent');
      } else {
        throw new Error(data.error || 'Failed to reannounce torrent');
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

  const renderMenuItems = () => {
    const items = [];

    // Common options for all types
    items.push(
      <button
        key="copy-id"
        onClick={handleCopyId}
        className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        {Icons.copy}
        <span className="ml-2">Copy ID</span>
      </button>,
    );

    items.push(
      <button
        key="copy-hash"
        onClick={handleCopyHash}
        className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
      >
        {Icons.copy}
        <span className="ml-2">Copy Hash</span>
      </button>,
    );

    // Torrent-specific options
    if (activeType === 'torrents') {
      items.push(
        <button
          key="copy-short-magnet"
          onClick={handleCopyShortMagnet}
          className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
        >
          {Icons.copy}
          <span className="ml-2">Copy Short Magnet</span>
        </button>,
      );

      if (item.active) {
        items.push(
          <button
            key="copy-full-magnet"
            onClick={handleCopyFullMagnet}
            disabled={isExporting}
            className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
          >
            {isExporting ? <Spinner size="xs" /> : Icons.copy}
            <span className="ml-2">Copy Full Magnet</span>
          </button>,
        );

        items.push(
          <button
            key="reannounce"
            onClick={handleReannounce}
            disabled={isReannouncing}
            className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
          >
            {isReannouncing ? <Spinner size="xs" /> : Icons.refresh}
            <span className="ml-2">Reannounce</span>
          </button>,
        );
      }

      items.push(
        <button
          key="export-torrent"
          onClick={handleExportTorrent}
          disabled={isExporting}
          className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark disabled:opacity-50"
        >
          {isExporting ? <Spinner size="xs" /> : Icons.download}
          <span className="ml-2">Export .torrent</span>
        </button>,
      );
    }

    // WebDL-specific options
    if (activeType === 'webdl') {
      items.push(
        <button
          key="copy-source-url"
          onClick={handleCopySourceUrl}
          className="flex items-center w-full px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark"
        >
          {Icons.copy}
          <span className="ml-2">Copy Source URL</span>
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
        title="More Options"
      >
        {Icons.vertical_ellipsis}
        {isMobile && <span className="ml-2 text-xs">More</span>}
      </button>

      {isMenuOpen &&
        isMounted &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 w-48 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-md shadow-lg"
            style={{
              top: `${menuPosition.top}px`,
              right: `${menuPosition.right}px`,
            }}
          >
            <div className="py-1">{renderMenuItems()}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
