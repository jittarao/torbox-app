'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useUpload } from '../shared/hooks/useUpload';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import Toast from '../shared/Toast';
import { getItem, setItem } from '@/utils/storage';
import {
  getAssetTypeInfo,
  getExpandedStates,
  saveExpandedStates,
  UPLOADER_OPTIONS_KEY,
  NZB_TIPS_HIDDEN_KEY,
} from './itemUploaderUtils';
import ItemUploaderExpandedContent from './ItemUploaderExpandedContent';

export default function ItemUploader({ apiKey, activeType = 'torrents' }) {
  const t = useTranslations('ItemUploader');
  const commonT = useTranslations('Common');
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
    webdlPassword,
    setWebdlPassword,
  } = useUpload(apiKey, activeType);

  const [isExpanded, setIsExpanded] = useState(() => {
    const states = getExpandedStates();
    return states[activeType] || false;
  });
  const isMobile = useIsMobile();
  const [toast, setToast] = useState(null);
  const [nzbTipsHidden, setNzbTipsHidden] = useState(() => {
    const saved = getItem(NZB_TIPS_HIDDEN_KEY);
    return saved !== null ? saved === 'true' : false;
  });

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (error) {
      setToast({
        message: error,
        type: 'error',
      });
    }
  }, [error]);

  useEffect(() => {
    const hasCompletedUploads = items.some((item) => item.status === 'success');
    const hasNoQueuedItems = !items.some(
      (item) => item.status === 'queued' || item.status === 'processing'
    );

    if (hasCompletedUploads && hasNoQueuedItems && !isUploading) {
      const successCount = items.filter((item) => item.status === 'success').length;
      const totalCount = items.length;

      if (successCount > 0 && successCount === totalCount) {
        setToast({
          message: `Successfully uploaded ${successCount} ${activeType === 'usenet' ? 'NZB' : activeType === 'torrents' ? 'torrent' : 'download'}${successCount > 1 ? 's' : ''}`,
          type: 'success',
        });
      }
    }
  }, [items, isUploading, activeType]);

  const assetTypeInfo = getAssetTypeInfo(activeType, t, commonT);

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

  if (!isClient) return null;

  return (
    <div className="px-3 py-1.5 lg:px-3 lg:py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
          {isMobile ? assetTypeInfo.mobileTitle : assetTypeInfo.title}
        </h3>
        <div className="flex items-center gap-2 lg:gap-4">
          {activeType === 'torrents' && isExpanded && (
            <button
              type="button"
              onClick={() => {
                const next = !showOptions;
                setShowOptions(next);
                if (activeType === 'torrents') {
                  setItem(UPLOADER_OPTIONS_KEY, next.toString());
                }
              }}
              className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            >
              {showOptions ? t('options.hide') : t('options.show')}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`size-4 transition-transform duration-200 ${showOptions ? 'rotate-180' : ''}`}
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
            type="button"
            onClick={() => {
              const next = !isExpanded;
              setIsExpanded(next);
              const expandedStates = getExpandedStates();
              expandedStates[activeType] = next;
              saveExpandedStates(expandedStates);
            }}
            className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
            aria-expanded={isExpanded}
          >
            {isExpanded ? t('section.hide') : t('section.show')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`size-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
        <ItemUploaderExpandedContent
          activeType={activeType}
          assetTypeInfo={assetTypeInfo}
          linkInput={linkInput}
          setLinkInput={setLinkInput}
          handleKeyDown={handleKeyDown}
          processInputLinks={processInputLinks}
          isUploading={isUploading}
          validateAndAddFiles={validateAndAddFiles}
          webdlPassword={webdlPassword}
          setWebdlPassword={setWebdlPassword}
          showOptions={showOptions}
          setShowOptions={setShowOptions}
          globalOptions={globalOptions}
          updateGlobalOptions={updateGlobalOptions}
          items={items}
          setItems={setItems}
          uploadItems={uploadItems}
          progress={progress}
          error={error}
          setError={setError}
          t={t}
          nzbTipsHidden={nzbTipsHidden}
          setNzbTipsHidden={setNzbTipsHidden}
          handleDismiss={handleDismiss}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
