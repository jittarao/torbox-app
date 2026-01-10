'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useFilter } from '../shared/hooks/useFilter';
import { useSelection } from '../shared/hooks/useSelection';
import { useSort } from '../shared/hooks/useSort';
import useIsMobile from '../../hooks/useIsMobile';

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
import FiltersSection from './FiltersSection';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useDownloadTags } from '@/components/shared/hooks/useDownloadTags';
import { useTags } from '@/components/shared/hooks/useTags';
import { useNotificationsStore } from '@/store/notificationsStore';
import { formatSize } from './utils/formatters';

export default function Downloads({ apiKey }) {
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const hasExpandedRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const isMobile = useIsMobile();

  // Ensure user database exists when API key is provided
  useEffect(() => {
    if (apiKey && apiKey.length >= 20) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey).then((result) => {
          if (result.success && result.wasCreated) {
            console.log('User database created for API key in Downloads component');
          }
        }).catch((error) => {
          console.error('Error ensuring user database:', error);
        });
      });
    }
  }, [apiKey]);

  // Function to expand all items with files
  const expandAllFiles = () => {
    const itemsWithFiles = itemsWithTags.filter(item => item.files && item.files.length > 0);
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

  // Load tags
  const { loadTags, tags, loading: tagsLoading } = useTags(apiKey);

  // Load tags once when component mounts
  useEffect(() => {
    if (apiKey && tags.length === 0 && !tagsLoading) {
      loadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Load download tags
  const { fetchDownloadTags, mapTagsToDownloads, tagMappings, loading: downloadTagsLoading } = useDownloadTags(apiKey);

  // Load download tags once when component mounts
  useEffect(() => {
    if (apiKey && Object.keys(tagMappings).length === 0 && !downloadTagsLoading) {
      fetchDownloadTags();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Map tags to items whenever items or tagMappings change
  const itemsWithTags = useMemo(() => {
    if (!items || items.length === 0) return items;
    return mapTagsToDownloads(items);
  }, [items, tagMappings, mapTagsToDownloads]);

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection(itemsWithTags);
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
  const { sortField, sortDirection, handleSort, setSort, sortTorrents } = useSort();

  const [columnFilters, setColumnFilters] = useState({
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [],
      },
    ],
  });
  const [appliedFilters, setAppliedFilters] = useState({
    logicOperator: 'and',
    groups: [
      {
        logicOperator: 'and',
        filters: [],
      },
    ],
  });
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(itemsWithTags, '', 'all', appliedFilters);

  // Load custom views
  const { views, activeView, applyView, clearView, loadViews, loading: viewsLoading } = useCustomViews(apiKey);

  // Load custom views once when component mounts
  useEffect(() => {
    if (apiKey && views.length === 0 && !viewsLoading) {
      loadViews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Start notifications polling once when component mounts
  const { fetchNotifications: fetchNotificationsStore } = useNotificationsStore();
  useEffect(() => {
    if (apiKey) {
      // Perform initial fetch
      fetchNotificationsStore(apiKey);

      // Set up periodic polling (every 2 minutes)
      const interval = setInterval(() => {
        // Read isPolling from store inside callback to get current value
        const { isPolling } = useNotificationsStore.getState();
        if (isPolling) {
          fetchNotificationsStore(apiKey);
        }
      }, 120000); // 2 minutes

      return () => {
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const sortedItems = sortTorrents(filteredItems);

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
        const item = itemsWithTags.find(i => i.id === itemId);
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
      // If mobile, always set to table view
      setViewMode(isMobile ? 'table' : storedViewMode);
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
        const item = itemsWithTags.find((i) => i.id === itemId);
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
      const item = itemsWithTags.find((i) => i.id === itemId);
      return acc + (item?.size || 0);
    }, 0);

    return formatSize(filesSize + itemsSize);
  }, [itemsWithTags, selectedItems]);

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
        <div className="mb-4">
          {/* Torrents Upload Section */}
          <ItemUploader apiKey={apiKey} activeType="torrents" />

          {/* Usenet Upload Section */}
          <ItemUploader apiKey={apiKey} activeType="usenet" />

          {/* Web Downloads Upload Section */}
          <ItemUploader apiKey={apiKey} activeType="webdl" />
        </div>
      )}

      {(activeType === 'torrents' || activeType === 'all') && <AutomationRules />}

      {loading ? (
        <div className="flex justify-center items-center">
          <Spinner
            size="sm"
            className="text-primary-text dark:text-primary-text-dark"
          />
        </div>
      ) : (
        <>
          <SpeedChart items={items} />

          <DownloadPanel
            downloadLinks={downloadLinks}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            onDismiss={() => setDownloadLinks([])}
            isDownloadPanelOpen={isDownloadPanelOpen}
            setIsDownloadPanelOpen={setIsDownloadPanelOpen}
            setToast={setToast}
          />

          {/* Filters Section */}
          <FiltersSection
            apiKey={apiKey}
            activeType={activeType}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
            activeView={activeView}
            sortField={sortField}
            sortDirection={sortDirection}
            activeColumns={activeColumns}
            onApplyView={(view) => {
              applyView(view);
              
              // Reset status filter to 'all' when applying a view
              setStatusFilter('all');
              
              // Parse filters if they're stored as JSON string (defensive)
              let filters = view.filters;
              if (typeof filters === 'string') {
                try {
                  filters = JSON.parse(filters);
                } catch (e) {
                  console.error('Error parsing view filters:', e);
                  filters = null;
                }
              }
              
              // Normalize filters structure
              let normalizedFilters = {
                logicOperator: 'and',
                groups: [
                  {
                    logicOperator: 'and',
                    filters: [],
                  },
                ],
              };
              
              if (filters) {
                if (filters.groups && Array.isArray(filters.groups)) {
                  // New group structure - deep copy to ensure React detects change
                  normalizedFilters = JSON.parse(JSON.stringify(filters));
                } else if (Array.isArray(filters)) {
                  // Old flat structure - convert to groups
                  normalizedFilters = {
                    logicOperator: 'and',
                    groups: [
                      {
                        logicOperator: 'and',
                        filters: filters,
                      },
                    ],
                  };
                }
              }
              
              // Apply filters - set both draft and applied
              setColumnFilters(normalizedFilters);
              setAppliedFilters(normalizedFilters);
              
              // Apply sort if specified
              if (view.sort_field) {
                setSort(view.sort_field, view.sort_direction || 'desc');
              }
              
              // Apply visible columns if specified
              let visibleColumns = view.visible_columns;
              if (visibleColumns) {
                // Parse visible_columns if it's a JSON string (defensive)
                if (typeof visibleColumns === 'string') {
                  try {
                    visibleColumns = JSON.parse(visibleColumns);
                  } catch (e) {
                    console.error('Error parsing visible columns:', e);
                    visibleColumns = null;
                  }
                }
                if (Array.isArray(visibleColumns) && visibleColumns.length > 0) {
                  handleColumnChange(visibleColumns);
                }
              }
            }}
            onClearView={() => {
              clearView();
              const emptyFilters = {
                logicOperator: 'and',
                groups: [
                  {
                    logicOperator: 'and',
                    filters: [],
                  },
                ],
              };
              setColumnFilters(emptyFilters);
              setAppliedFilters(emptyFilters);
            }}
            onFiltersChange={(filters) => {
              // Apply the filters to the table
              setAppliedFilters(filters);
            }}
          />

          {/* Divider */}
          <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

          <div
            ref={scrollContainerRef}
            className={`${isFullscreen ? 'fixed inset-0 z-20 bg-surface dark:bg-surface-dark overflow-auto' : 'relative z-[1]'} ${
              downloadLinks.length > 0 ? 'mb-12' : ''
            }`}
          >
            {/* ActionBar - becomes fixed when scrolled past */}
            <ActionBar
              unfilteredItems={itemsWithTags}
              filteredItems={filteredItems}
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
                deleteItems(selectedItems, includeParentDownloads, itemsWithTags)
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
              scrollContainerRef={scrollContainerRef}
            />

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
                isFullscreen={isFullscreen}
                scrollContainerRef={scrollContainerRef}
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
                scrollContainerRef={scrollContainerRef}
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
