'use client';

import { useEffect, useState } from 'react';
import { useUpload } from '../shared/hooks/useUpload';
import { DropZone } from '../shared/DropZone';
import TorrentOptions from './TorrentOptions';
import UploadItemList from './UploadItemList';
import UploadProgress from './UploadProgress';
import { saEvent } from '@/utils/sa';

export default function ItemUploader({ apiKey, activeType = 'torrents' }) {
  const {
    items,
    setItems,
    linkInput,
    setLinkInput,
    error,
    setError,
    globalOptions,
    updateGlobalOptions,
    showOptions,
    setShowOptions,
    validateAndAddFiles,
    uploadItems,
    isUploading,
    progress,
  } = useUpload(apiKey, activeType);

  // State to track if the uploader is expanded or collapsed
  const [isExpanded, setIsExpanded] = useState(false);

  // Set initial expanded state based on screen size
  useEffect(() => {
    const handleResize = () => {
      // Desktop (>= 1024px) is expanded by default, mobile/tablet is collapsed
      setIsExpanded(window.innerWidth >= 1024);
    };

    // Set initial state
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear items when switching asset types
  useEffect(() => {
    setItems([]);
    setError(null);
  }, [activeType, setItems, setError]);

  // Get asset type specific labels
  const getAssetTypeInfo = () => {
    switch (activeType) {
      case 'usenet':
        return {
          title: 'Upload NZB Files',
          inputPlaceholder: 'Paste NZB links here (one per line)',
          dropzoneText: 'Drop NZB files here',
          buttonText: 'Upload NZB',
          fileExtension: '.nzb',
          showDropzone: true,
        };
      case 'webdl':
        return {
          title: 'Add Web Downloads',
          inputPlaceholder: 'Paste web download links here (one per line)',
          dropzoneText: '',
          buttonText: 'Add Links',
          fileExtension: '',
          showDropzone: false,
        };
      default:
        return {
          title: 'Upload Torrents',
          inputPlaceholder: 'Paste magnet links here (one per line)',
          dropzoneText: 'Drop torrent files here',
          buttonText: 'Upload Torrents',
          fileExtension: '.torrent',
          showDropzone: true,
        };
    }
  };

  const assetTypeInfo = getAssetTypeInfo();

  const handleDismiss = () => {
    setItems([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processInputLinks();
    }
  };

  const processInputLinks = () => {
    if (!linkInput.trim()) return;

    setLinkInput(linkInput);
  };

  return (
    <div className="mt-4 p-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
          {assetTypeInfo.title}
        </h3>
        <div className="flex items-center gap-4">
          {activeType === 'torrents' && isExpanded && (
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1 text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            >
              {showOptions ? 'Hide Options' : 'Show Options'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-4 h-4 transition-transform duration-200 ${showOptions ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Hide section' : 'Show section'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div
            className={`grid ${assetTypeInfo.showDropzone ? 'xl:grid-cols-2 gap-2 xl:gap-6' : 'grid-cols-1'} mt-4`}
          >
            <div className={assetTypeInfo.showDropzone ? '' : 'w-full'}>
              <textarea
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (activeType === 'webdl') {
                    processInputLinks();
                  }
                }}
                disabled={isUploading}
                placeholder={assetTypeInfo.inputPlaceholder}
                className="w-full min-h-40 h-40 p-3 border border-border dark:border-border-dark rounded-lg 
                  bg-transparent text-primary-text dark:text-primary-text-dark 
                  placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
                  focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
                  focus:border-accent dark:focus:border-accent-dark
                  disabled:bg-surface-alt dark:disabled:bg-surface-alt-dark 
                  disabled:text-primary-text/50 dark:disabled:text-primary-text-dark/50
                  transition-colors duration-200"
              />
            </div>

            {assetTypeInfo.showDropzone && (
              <div>
                <DropZone
                  onDrop={validateAndAddFiles}
                  disabled={isUploading}
                  acceptedFileTypes={assetTypeInfo.fileExtension}
                  dropzoneText={assetTypeInfo.dropzoneText}
                />
              </div>
            )}
          </div>

          {/* Options section */}
          {activeType === 'torrents' && (
            <TorrentOptions
              showOptions={showOptions}
              globalOptions={globalOptions}
              updateGlobalOptions={updateGlobalOptions}
            />
          )}

          <UploadItemList
            items={items}
            setItems={setItems}
            uploading={isUploading}
            activeType={activeType}
          />

          {error && <div className="text-red-500 mt-3 text-sm">{error}</div>}

          <UploadProgress progress={progress} uploading={isUploading} />

          {items.filter((item) => item.status === 'queued').length > 0 &&
            !isUploading && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    uploadItems();
                    saEvent('upload_items');
                  }}
                  disabled={isUploading}
                  className="mt-4 bg-accent hover:bg-accent/90 text-white text-sm px-6 py-2 mb-4 rounded-md
                transition-colors duration-200 disabled:bg-accent/90 disabled:cursor-not-allowed"
                >
                  {assetTypeInfo.buttonText} (
                  {items.filter((item) => item.status === 'queued').length})
                </button>
              </div>
            )}

          {items.length > 0 &&
            !items.some(
              (item) =>
                item.status === 'queued' || item.status === 'processing',
            ) && (
              <div className="flex gap-4 items-center justify-end mt-4">
                <h3 className="text-sm text-primary-text dark:text-primary-text-dark/70">
                  {items.filter((item) => item.status === 'success').length} of{' '}
                  {items.length} items processed
                </h3>

                <button
                  onClick={handleDismiss}
                  className="text-primary-text/70 hover:text-primary-text dark:text-primary-text-dark dark:hover:text-primary-text-dark/70"
                  aria-label="Close panel"
                >
                  Clear items
                </button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
