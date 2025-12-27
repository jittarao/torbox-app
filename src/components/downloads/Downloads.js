'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useFilter } from '../shared/hooks/useFilter';
import { useSelection } from '../shared/hooks/useSelection';
import { useSort } from '../shared/hooks/useSort';
import { useAutomationRules } from '../shared/hooks/useAutomationRules';

import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import DownloadPanel from './DownloadPanel';
import ItemUploader from './ItemUploader';
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';
import ItemsTable from './ItemsTable';
import ActionBar from './ActionBar/index';
import CardList from './CardList';
import AutomationRules from './AutomationRules';
import { formatSize } from './utils/formatters';
import { useTranslations } from 'next-intl';

export default function Downloads({ apiKey }) {
  const t = useTranslations('Common');
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [expandedUploadSections, setExpandedUploadSections] = useState(new Set());
  const hasExpandedRef = useRef(false);

  // Function to expand all items with files
  const expandAllFiles = () => {
    const itemsWithFiles = items.filter(item => item.files && item.files.length > 0);
    const itemIds = itemsWithFiles.map(item => item.id);
    setExpandedItems(new Set(itemIds));
  };

  // Function to collapse all files
  const collapseAllFiles = () => {
    setExpandedItems(new Set());
  };

  const { loading, items, setItems, fetchItems } = useFetchData(
    apiKey,
    activeType,
  );

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection(items);
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
  } = useDownloads(apiKey, activeType, downloadHistory, setDownloadHistory);

  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setItems,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType,
  );

  const { activeColumns, handleColumnChange } = useColumnManager(activeType);
  const { sortField, sortDirection, handleSort, sortTorrents } = useSort();

  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(items);

  const sortedItems = sortTorrents(filteredItems);

  // Initialize automation rules
  useAutomationRules(items, apiKey, activeType);



  const onFullscreenToggle = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Bulk export torrent files
  const handleBulkExport = async () => {
    if (isExporting || activeType !== 'torrents') return;
    setIsExporting(true);

    try {
      const selectedItemIds = Array.from(selectedItems.items);
      if (selectedItemIds.length === 0) {
        setToast({
          message: 'No items selected for export',
          type: 'error',
        });
        return;
      }

      // Export each selected torrent
      for (const itemId of selectedItemIds) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        try {
          const response = await fetch(
            `/api/torrents/export?torrent_id=${itemId}&type=torrent`,
            {
              headers: {
                'x-api-key': apiKey,
              },
            },
          );

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
          } else {
            console.error(`Failed to export torrent ${itemId}`);
          }
        } catch (error) {
          console.error(`Error exporting torrent ${itemId}:`, error);
        }
      }

      setToast({
        message: `Exported ${selectedItemIds.length} torrent files`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error during bulk export:', error);
      setToast({
        message: 'Failed to export torrent files',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleFiles = (itemId) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    const storedViewMode = localStorage.getItem('downloads-view-mode');
    if (storedViewMode) {
      setViewMode(storedViewMode);
    }
  }, []);

  useEffect(() => {
    const storedDownloadHistory = localStorage.getItem('torboxDownloadHistory');
    if (storedDownloadHistory) {
      try {
        setDownloadHistory(JSON.parse(storedDownloadHistory));
      } catch (error) {
        console.error('Error parsing download history from localStorage:', error);
        setDownloadHistory([]);
      }
    }
  }, []);

  // Expand rows with selected files on initial load
  useEffect(() => {
    if (!items?.length || !selectedItems?.files?.size) return;
    if (hasExpandedRef.current) return;

    // Expand all items that have selected files
    selectedItems.files.forEach((_, itemId) => {
      setExpandedItems((prev) => new Set([...prev, itemId]));
    });

    hasExpandedRef.current = true;
  }, [items, selectedItems.files]);

  // Get the total size of all selected items and files
  const getTotalDownloadSize = useCallback(() => {
    // Calculate size of selected files
    const filesSize = Array.from(selectedItems.files.entries()).reduce(
      (acc, [itemId, fileIds]) => {
        const item = items.find((i) => i.id === itemId);
        if (!item) return acc;

        return (
          acc +
          Array.from(fileIds).reduce((sum, fileId) => {
            const file = item.files.find((f) => f.id === fileId);
            return sum + (file?.size || 0);
          }, 0)
        );
      },
      0,
    );

    // Calculate size of selected items
    const itemsSize = Array.from(selectedItems.items).reduce((acc, itemId) => {
      const item = items.find((i) => i.id === itemId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [items, selectedItems]);

  return (
    <div>
      <AssetTypeTabs
        activeType={activeType}
        onTypeChange={(type) => {
          setActiveType(type);
          setSelectedItems({ items: new Set(), files: new Map() });
        }}
      />

      {activeType !== 'all' && <ItemUploader apiKey={apiKey} activeType={activeType} />}

      {/* Collapsible sections for "all" view */}
      {activeType === 'all' && (
        <div className="space-y-4 mb-6">
          {/* Gap to match other pages */}
          <div className="h-4"></div>

          {/* Torrents Upload Section */}
          <div className="border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
            <button
              onClick={() => {
                const newExpanded = new Set(expandedUploadSections);
                if (newExpanded.has('torrents')) {
                  newExpanded.delete('torrents');
                } else {
                  newExpanded.add('torrents');
                }
                setExpandedUploadSections(newExpanded);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
            >
              <span className="font-medium text-primary-text dark:text-primary-text-dark">{t('uploadSections.torrents')}</span>
              <svg
                className={`w-5 h-5 text-primary-text/60 dark:text-primary-text-dark/60 transition-transform ${
                  expandedUploadSections.has('torrents') ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedUploadSections.has('torrents') && (
              <div className="px-4 pb-4">
                <ItemUploader apiKey={apiKey} activeType="torrents" />
              </div>
            )}
          </div>

          {/* Usenet Upload Section */}
          <div className="border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
            <button
              onClick={() => {
                const newExpanded = new Set(expandedUploadSections);
                if (newExpanded.has('usenet')) {
                  newExpanded.delete('usenet');
                } else {
                  newExpanded.add('usenet');
                }
                setExpandedUploadSections(newExpanded);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
            >
              <span className="font-medium text-primary-text dark:text-primary-text-dark">{t('uploadSections.usenet')}</span>
              <svg
                className={`w-5 h-5 text-primary-text/60 dark:text-primary-text-dark/60 transition-transform ${
                  expandedUploadSections.has('usenet') ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedUploadSections.has('usenet') && (
              <div className="px-4 pb-4">
                <ItemUploader apiKey={apiKey} activeType="usenet" />
              </div>
            )}
          </div>

          {/* Web Downloads Upload Section */}
          <div className="border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
            <button
              onClick={() => {
                const newExpanded = new Set(expandedUploadSections);
                if (newExpanded.has('webdl')) {
                  newExpanded.delete('webdl');
                } else {
                  newExpanded.add('webdl');
                }
                setExpandedUploadSections(newExpanded);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
            >
              <span className="font-medium text-primary-text dark:text-primary-text-dark">{t('uploadSections.webdl')}</span>
              <svg
                className={`w-5 h-5 text-primary-text/60 dark:text-primary-text-dark/60 transition-transform ${
                  expandedUploadSections.has('webdl') ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedUploadSections.has('webdl') && (
              <div className="px-4 pb-4">
                <ItemUploader apiKey={apiKey} activeType="webdl" />
              </div>
            )}
          </div>
        </div>
      )}

      {(activeType === 'torrents' || activeType === 'all') && <AutomationRules />}

      {loading && items.length === 0 ? (
        <div className="flex justify-center items-center">
          <Spinner
            size="sm"
            className="text-primary-text dark:text-primary-text-dark"
          />
        </div>
      ) : (
        <>
          <SpeedChart items={items} activeType={activeType} />

          <DownloadPanel
            downloadLinks={downloadLinks}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            onDismiss={() => setDownloadLinks([])}
            isDownloadPanelOpen={isDownloadPanelOpen}
            setIsDownloadPanelOpen={setIsDownloadPanelOpen}
            setToast={setToast}
          />

          {/* Divider */}
          <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

          <div
            className={`${isFullscreen ? 'fixed inset-0 z-20 bg-surface dark:bg-surface-dark overflow-auto' : 'overflow-y-auto'} ${
              downloadLinks.length > 0 ? 'mb-12' : ''
            }`}
          >
            {/* Wrap ActionBar in a sticky container */}
            <div className="sticky top-0 z-20">
              <ActionBar
                unfilteredItems={items}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                hasSelectedFiles={hasSelectedFiles}
                activeColumns={activeColumns}
                onColumnChange={handleColumnChange}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                isDownloading={isDownloading}
                onBulkDownload={() =>
                  handleBulkDownload(selectedItems, sortedItems)
                }
                isDeleting={isDeleting}
                onBulkDelete={(includeParentDownloads) =>
                  deleteItems(selectedItems, includeParentDownloads, items)
                }
                isExporting={isExporting}
                onBulkExport={handleBulkExport}
                activeType={activeType}
                isBlurred={isBlurred}
                onBlurToggle={() => setIsBlurred(!isBlurred)}
                isFullscreen={isFullscreen}
                onFullscreenToggle={onFullscreenToggle}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortField={sortField}
                sortDir={sortDirection}
                handleSort={handleSort}
                getTotalDownloadSize={getTotalDownloadSize}
                isDownloadPanelOpen={isDownloadPanelOpen}
                setIsDownloadPanelOpen={setIsDownloadPanelOpen}
                apiKey={apiKey}
                setToast={setToast}
                expandAllFiles={expandAllFiles}
                collapseAllFiles={collapseAllFiles}
                expandedItems={expandedItems}
              />
            </div>

            {viewMode === 'table' ? (
              <ItemsTable
                apiKey={apiKey}
                activeType={activeType}
                activeColumns={activeColumns}
                setItems={setItems}
                selectedItems={selectedItems}
                handleSelectAll={handleSelectAll}
                handleFileSelect={handleFileSelect}
                handleRowSelect={handleRowSelect}
                setSelectedItems={setSelectedItems}
                downloadHistory={downloadHistory}
                setDownloadHistory={setDownloadHistory}
                isBlurred={isBlurred}
                deleteItem={deleteItem}
                sortedItems={sortedItems}
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                setToast={setToast}
                expandedItems={expandedItems}
                toggleFiles={toggleFiles}
              />
            ) : (
              <CardList
                items={sortedItems}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                setItems={setItems}
                apiKey={apiKey}
                activeColumns={activeColumns}
                onFileSelect={handleFileSelect}
                downloadHistory={downloadHistory}
                setDownloadHistory={setDownloadHistory}
                onDelete={deleteItem}
                expandedItems={expandedItems}
                toggleFiles={toggleFiles}
                setToast={setToast}
                activeType={activeType}
                isBlurred={isBlurred}
                isFullscreen={isFullscreen}
                viewMode={viewMode}
              />
            )}
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
