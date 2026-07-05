'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useIsClient from '@/hooks/useIsClient';
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';
import { useDownloadsDataContext } from './DownloadsDataContext';
import { useDownloadsFilterContext } from './DownloadsFilterContext';
import { useDownloadsUIContext } from './DownloadsUIContext';
import { useDownloadsContext } from './DownloadsContext';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import useIsMobile from '@/hooks/useIsMobile';
import TrackSelectionModal from './TrackSelectionModal';
import OpenInModal from './OpenInModal';
import { useStreamInitializer } from './hooks/useStreamInitializer';
import { tableContainerClass } from './utils/responsiveLayout';
import { computeResolvedColumnWidths } from './utils/tableColumnLayout';

export default function ItemsTable() {
  const { sortedItems, activeColumns, downloadHistoryLookup, tagMappings } =
    useDownloadsDataContext();

  const selectedItems = useDownloadsSelectionStore(useShallow((s) => s.selectedItems));

  const { sortField, sortDirection, handleSort, search: fileSearch } = useDownloadsFilterContext();

  const { activeType, isBlurred, isFullscreen, displayViewMode, scrollContainerRef } =
    useDownloadsUIContext();

  const {
    apiKey,
    setSelectedItems,
    handleSelectAll,
    handleFileSelect,
    deleteItem,
    setToast,
    toggleFiles,
    onOpenVideoPlayer,
    onAudioPlay,
  } = useDownloadsContext();

  const {
    openInModal,
    closeOpenInModal,
    handleOpenInChoice,
    isCreatingStream,
    loadingChoice,
    openInError,
    trackSelectionModal,
    closeTrackSelectionModal,
    handleFileStreamInit,
    handleTrackSelection,
  } = useStreamInitializer({ apiKey, activeType, onOpenVideoPlayer });

  const [tableWidth, setTableWidth] = useState(0);
  const isClient = useIsClient();
  const tableContainerRef = useRef(null);

  useEffect(() => {
    updateTableWidth();
    window.addEventListener('resize', updateTableWidth);
    return () => {
      window.removeEventListener('resize', updateTableWidth);
    };
  }, []);

  const updateTableWidth = () => {
    if (tableContainerRef.current) {
      const width = tableContainerRef.current.clientWidth;
      setTableWidth(width);
    }
  };

  const { columnWidths, updateColumnWidth } = useColumnWidths(activeType);
  const isMobile = useIsMobile();

  const columnLayout = useMemo(
    () => computeResolvedColumnWidths(activeColumns, columnWidths, tableWidth, isMobile),
    [activeColumns, columnWidths, tableWidth, isMobile]
  );

  useEffect(() => {
    updateTableWidth();
  }, [columnLayout]);

  return (
    <>
      <div ref={tableContainerRef} id="items-table" className={tableContainerClass}>
        <table
          className="w-full table-fixed border-separate border-spacing-0 relative md:text-xs lg:text-sm"
          style={
            columnLayout.tableMinWidth ? { minWidth: `${columnLayout.tableMinWidth}px` } : undefined
          }
        >
          <TableHeader
            activeColumns={activeColumns}
            resolvedColumnWidths={isClient ? columnLayout.resolved : {}}
            updateColumnWidth={updateColumnWidth}
            selectedItems={selectedItems}
            onSelectAll={handleSelectAll}
            items={sortedItems}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableBody
            items={sortedItems}
            activeColumns={activeColumns}
            resolvedColumnWidths={columnLayout.resolved}
            selectedItems={selectedItems}
            onFileSelect={handleFileSelect}
            setSelectedItems={setSelectedItems}
            downloadHistoryLookup={downloadHistoryLookup}
            tagMappings={tagMappings}
            apiKey={apiKey}
            onDelete={deleteItem}
            setToast={setToast}
            activeType={activeType}
            isBlurred={isBlurred}
            viewMode={displayViewMode}
            toggleFiles={toggleFiles}
            tableWidth={tableWidth}
            isFullscreen={isFullscreen}
            scrollContainerRef={scrollContainerRef}
            onFileStreamInit={handleFileStreamInit}
            onAudioPlay={onAudioPlay}
            fileSearch={fileSearch}
          />
        </table>
      </div>
      <OpenInModal
        isOpen={openInModal.isOpen}
        onClose={closeOpenInModal}
        onSelect={handleOpenInChoice}
        file={openInModal.file}
        fileName={openInModal.fileName}
        itemName={openInModal.itemName}
        isLoading={isCreatingStream}
        loadingChoice={loadingChoice}
        error={openInError}
      />
      <TrackSelectionModal
        isOpen={trackSelectionModal.isOpen}
        onClose={closeTrackSelectionModal}
        onPlay={handleTrackSelection}
        metadata={trackSelectionModal.metadata}
        introInformation={trackSelectionModal.introInformation}
        fileName={trackSelectionModal.fileName}
      />
    </>
  );
}
