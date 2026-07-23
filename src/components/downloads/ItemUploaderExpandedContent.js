'use client';

import { DropZone } from '../shared/DropZone';
import TorrentOptions from './TorrentOptions';
import UploadItemList from './UploadItemList';
import UploadProgress from './UploadProgress';
import { phEvent } from '@/utils/sa';
import { setItem } from '@/utils/storage';
import { UPLOADER_OPTIONS_KEY, NZB_TIPS_HIDDEN_KEY } from './itemUploaderUtils';
import ItemUploaderNzbTips from './ItemUploaderNzbTips';
import ItemUploaderCompletionBar from './ItemUploaderCompletionBar';

export default function ItemUploaderExpandedContent({
  activeType,
  assetTypeInfo,
  linkInput,
  setLinkInput,
  handleKeyDown,
  processInputLinks,
  isUploading,
  validateAndAddFiles,
  webdlPassword,
  setWebdlPassword,
  showOptions,
  setShowOptions,
  globalOptions,
  updateGlobalOptions,
  items,
  setItems,
  uploadItems,
  progress,
  error,
  setError,
  t,
  nzbTipsHidden,
  setNzbTipsHidden,
  handleDismiss,
}) {
  return (
    <>
      <div
        className={`grid ${
          assetTypeInfo.showDropzone ? 'lg:grid-cols-2 gap-2 lg:gap-6' : 'grid-cols-1'
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

      {activeType === 'webdl' && (
        <div className="mt-2">
          <input
            type="password"
            value={webdlPassword}
            onChange={(e) => setWebdlPassword(e.target.value)}
            placeholder={t('placeholder.webdlPassword')}
            className="w-full p-2 border border-border dark:border-border-dark rounded-lg bg-transparent text-sm lg:text-base text-primary-text dark:text-primary-text-dark placeholder-primary-text/50 dark:placeholder-primary-text-dark/50 focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 focus:border-accent dark:focus:border-accent-dark transition-colors duration-200"
          />
        </div>
      )}

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

      {items.filter((item) => item.status === 'queued').length > 0 && !isUploading && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              uploadItems();
              phEvent('upload_items');
            }}
            disabled={isUploading}
            className="mt-4 w-full lg:w-auto bg-accent hover:bg-accent/90 text-white text-sm px-4 lg:px-4 py-2 mb-4 rounded-md
                transition-colors duration-200 disabled:bg-accent/90 disabled:cursor-not-allowed"
          >
            {assetTypeInfo.buttonText} ({items.filter((item) => item.status === 'queued').length})
          </button>
        </div>
      )}

      <UploadProgress progress={progress} uploading={isUploading} />

      {error && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <svg
                className="size-5 text-red-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">{t('errors.uploadFailed')}</p>
                <p className="mt-1 break-words">{error}</p>
                {error.includes('temporarily') && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {t('errors.temporaryIssue')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {activeType === 'usenet' && (
        <ItemUploaderNzbTips
          nzbTipsHidden={nzbTipsHidden}
          onHide={() => {
            setNzbTipsHidden(true);
            setItem(NZB_TIPS_HIDDEN_KEY, 'true');
          }}
          onShow={() => {
            setNzbTipsHidden(false);
            setItem(NZB_TIPS_HIDDEN_KEY, 'false');
          }}
          t={t}
        />
      )}

      <ItemUploaderCompletionBar items={items} t={t} onDismiss={handleDismiss} />
    </>
  );
}
