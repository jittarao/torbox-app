'use client';

import { useUploaderStore } from '@/store/uploaderStore';
import { useUploadQueue } from './useUploadQueue';
import { useUploadActions } from './useUploadActions';

export const useUpload = (apiKey, assetType = 'torrents') => {
  const queue = useUploadQueue(assetType);
  const actions = useUploadActions(apiKey, queue);

  return {
    items: queue.items,
    setItems: queue.setItems,
    linkInput: queue.linkInput,
    setLinkInput: queue.handleLinkInput,
    error: queue.error,
    setError: queue.setError,
    isUploading: queue.isUploading,
    progress: queue.progress,
    validateAndAddFiles: queue.validateAndAddFiles,
    uploadItem: actions.uploadItem,
    uploadItems: actions.uploadItems,
    removeItem: (queuedId) => useUploaderStore.getState().removeItem(queuedId),
    resetUploader: () => useUploaderStore.getState().resetUploader(),
    globalOptions: queue.globalOptions,
    updateGlobalOptions: queue.updateGlobalOptions,
    showOptions: queue.showOptions,
    setShowOptions: queue.setShowOptions,
    controlTorrent: actions.controlTorrent,
    controlQueuedItem: actions.controlQueuedItem,
    assetType: queue.assetType,
    webdlPassword: queue.webdlPassword,
    setWebdlPassword: queue.setWebdlPassword,
  };
};
