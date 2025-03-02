'use client';

import { useEffect, useState } from 'react';
import { useUpload } from '../shared/hooks/useUpload';
import { DropZone } from '../shared/DropZone';
import TorrentOptions from './TorrentOptions';
import UploadItemList from './UploadItemList';
import UploadProgress from './UploadProgress';
import useIsMobile from '@/hooks/useIsMobile';
import { phEvent } from '@/utils/sa';

// Local storage keys
const UPLOADER_EXPANDED_KEY = 'uploader-expanded';
const UPLOADER_OPTIONS_KEY = 'uploader-options-expanded';

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
  const [isClient, setIsClient] = useState(false);
  const isMobile = useIsMobile();

  // Set initial expanded state based on localStorage or screen size
  useEffect(() => {
    setIsClient(true);

    const handleResize = () => {
      // Only set default state if no localStorage value exists
      if (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem(UPLOADER_EXPANDED_KEY) === null
      ) {
        // Desktop (>= 1024px) is expanded by default, mobile/tablet is collapsed
        setIsExpanded(window.innerWidth >= 1024);
      }
    };

    // Try to get saved preference from localStorage
    if (typeof localStorage !== 'undefined') {
      const savedState = localStorage.getItem(UPLOADER_EXPANDED_KEY);
      if (savedState !== null) {
        setIsExpanded(savedState === 'true');
      } else {
        // If no saved preference, set based on screen size
        handleResize();
      }

      // Also load options expanded state
      if (activeType === 'torrents') {
        const savedOptionsState = localStorage.getItem(UPLOADER_OPTIONS_KEY);
        if (savedOptionsState !== null) {
          setShowOptions(savedOptionsState === 'true');
        }
      }
    } else {
      // Fallback if localStorage is not available
      handleResize();
    }

    // Add resize listener (only affects initial state when no localStorage value exists)
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [activeType, setShowOptions]);

  // Save expanded state to localStorage when it changes
  useEffect(() => {
    if (isClient && typeof localStorage !== 'undefined') {
      localStorage.setItem(UPLOADER_EXPANDED_KEY, isExpanded.toString());
    }
  }, [isExpanded, isClient]);

  // Save options expanded state to localStorage when it changes
  useEffect(() => {
    if (
      isClient &&
      typeof localStorage !== 'undefined' &&
      activeType === 'torrents'
    ) {
      localStorage.setItem(UPLOADER_OPTIONS_KEY, showOptions.toString());
    }
  }, [showOptions, isClient, activeType]);

  // Clear items when switching asset types
  useEffect(() => {
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

  const uploaderShowOptionsText = isMobile ? 'Show options' : 'Show options';
  const uploaderHideOptionsText = isMobile ? 'Hide options' : 'Hide options';
  const uploaderShowSectionText = isMobile ? 'Show' : 'Show section';
  const uploaderHideSectionText = isMobile ? 'Hide' : 'Hide section';

  // Don't render anything until client-side hydration is complete
  if (!isClient) return null;

  return (
    <div className="mt-4 px-2 py-2 lg:p-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-md lg:text-lg font-medium text-primary-text dark:text-primary-text-dark">
          {isMobile ? 'Upload' : assetTypeInfo.title}
        </h3>
        <div className="flex items-center gap-2 lg:gap-4">
          {activeType === 'torrents' && isExpanded && (
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            >
              {showOptions ? uploaderHideOptionsText : uploaderShowOptionsText}
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
            className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            aria-expanded={isExpanded}
          >
            {isExpanded ? uploaderHideSectionText : uploaderShowSectionText}
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
            className={`grid ${
              assetTypeInfo.showDropzone
                ? 'lg:grid-cols-2 gap-2 lg:gap-6'
                : 'grid-cols-1'
            } mt-4`}
          >
            <div className={`${assetTypeInfo.showDropzone ? '' : 'w-full'}`}>
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
                className="w-full min-h-[120px] lg:min-h-40 h-40 p-2 lg:p-3 border border-border dark:border-border-dark rounded-lg 
                  bg-transparent text-sm lg:text-base text-primary-text dark:text-primary-text-dark 
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

          {items.filter((item) => item.status === 'queued').length > 0 &&
            !isUploading && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    uploadItems();
                    phEvent('upload_items');
                  }}
                  disabled={isUploading}
                  className="mt-4 w-full lg:w-auto bg-accent hover:bg-accent/90 text-white text-sm px-4 lg:px-6 py-2 mb-4 rounded-md
                    transition-colors duration-200 disabled:bg-accent/90 disabled:cursor-not-allowed"
                >
                  {assetTypeInfo.buttonText} (
                  {items.filter((item) => item.status === 'queued').length})
                </button>
              </div>
            )}

          <UploadProgress progress={progress} uploading={isUploading} />

          {error && (
            <div className="text-red-500 mt-3 text-xs lg:text-sm break-words">
              {error}
            </div>
          )}

          {items.length > 0 &&
            !items.some(
              (item) =>
                item.status === 'queued' || item.status === 'processing',
            ) && (
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-end mt-4">
                <h3 className="text-xs lg:text-sm text-primary-text dark:text-primary-text-dark/70">
                  {items.filter((item) => item.status === 'success').length} of{' '}
                  {items.length} items processed
                </h3>

                <button
                  onClick={handleDismiss}
                  className="text-sm text-primary-text/70 hover:text-primary-text dark:text-primary-text-dark dark:hover:text-primary-text-dark/70"
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
