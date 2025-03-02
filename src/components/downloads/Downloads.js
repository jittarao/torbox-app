'use client';

import { useState } from 'react';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useSelection } from '../shared/hooks/useSelection';
import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import ItemUploader from './ItemUploader';
import DownloadPanel from './DownloadPanel';
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';
import ItemsTable from './ItemsTable';

export default function Downloads({ apiKey }) {
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('torrents');
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  } = useSelection();
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
  } = useDownloads(apiKey, activeType);

  return (
    <div>
      <AssetTypeTabs
        activeType={activeType}
        onTypeChange={(type) => {
          setActiveType(type);
          setSelectedItems({ items: new Set(), files: new Map() });
        }}
      />

      <ItemUploader apiKey={apiKey} activeType={activeType} />

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
            setToast={setToast}
          />

          {/* Divider */}
          <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

          <ItemsTable
            apiKey={apiKey}
            activeType={activeType}
            items={items}
            setItems={setItems}
            fetchItems={fetchItems}
            selectedItems={selectedItems}
            handleSelectAll={handleSelectAll}
            handleFileSelect={handleFileSelect}
            hasSelectedFiles={hasSelectedFiles}
            handleRowSelect={handleRowSelect}
            setSelectedItems={setSelectedItems}
            handleBulkDownload={handleBulkDownload}
            isDownloading={isDownloading}
            setToast={setToast}
            isFullscreen={isFullscreen}
            onFullscreenToggle={() => setIsFullscreen((prev) => !prev)}
          />
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
