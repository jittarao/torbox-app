'use client';

import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUploaderStore } from '@/store/uploaderStore';
import { getItem, getJSON, setItem, setJSON } from '@/utils/storage';

const STORAGE_KEY = 'torrent-upload-options';
const SHOW_OPTIONS_KEY = 'uploader-options-expanded';

export const DEFAULT_UPLOAD_OPTIONS = {
  seed: 1,
  allowZip: true,
  asQueued: false,
  autoStart: false,
  autoStartLimit: 3,
};

export function useUploadQueue(assetType = 'torrents') {
  const {
    items,
    error,
    isUploading,
    progress,
    addItems,
    setItems,
    setError,
    setIsUploading,
    setProgress,
    updateItemStatus,
  } = useUploaderStore(
    useShallow((s) => ({
      items: s.items,
      error: s.error,
      isUploading: s.isUploading,
      progress: s.progress,
      addItems: s.addItems,
      setItems: s.setItems,
      setError: s.setError,
      setIsUploading: s.setIsUploading,
      setProgress: s.setProgress,
      updateItemStatus: s.updateItemStatus,
    }))
  );

  const [linkInput, setLinkInput] = useState('');
  const [webdlPassword, setWebdlPassword] = useState('');
  const [globalOptions, setGlobalOptions] = useState(() => {
    const saved = getJSON(STORAGE_KEY);
    return saved ?? DEFAULT_UPLOAD_OPTIONS;
  });
  const [showOptions, setShowOptions] = useState(() => {
    const showOptionsValue = getItem(SHOW_OPTIONS_KEY);
    return showOptionsValue !== null ? showOptionsValue === 'true' : false;
  });

  const createBaseItem = (data, type) => ({
    type,
    status: 'queued',
    data,
    ...globalOptions,
  });

  const createFileItem = (file) => {
    if (file instanceof URL || typeof file === 'string') {
      const url = file.toString();
      return {
        ...createBaseItem(url, assetType),
        name: url.split('/').pop() || url,
      };
    }
    return {
      ...createBaseItem(file, assetType),
      name: file.name,
    };
  };

  const createLinkItem = async (link) => {
    let name = link.substring(0, 60) + '...';

    if (assetType === 'usenet') {
      try {
        if (link.includes('api') && (link.includes('nzb') || link.includes('usenet'))) {
          const url = new URL(link);
          const filenameParam =
            url.searchParams.get('filename') ||
            url.searchParams.get('name') ||
            url.searchParams.get('title');

          if (filenameParam) {
            name = decodeURIComponent(filenameParam);
          } else {
            const domain = url.hostname.replace('www.', '');
            name = `${domain} - NZB Download`;
          }
        } else if (link.includes('.nzb')) {
          const url = new URL(link);
          const pathParts = url.pathname.split('/');
          const filename = pathParts[pathParts.length - 1];
          if (filename && filename.endsWith('.nzb')) {
            name = filename.replace('.nzb', '');
          }
        }
      } catch (err) {
        console.warn('Failed to parse usenet link for filename:', err);
      }
    }

    return {
      ...createBaseItem(link, assetType === 'torrents' ? 'magnet' : assetType),
      name,
    };
  };

  const validateFiles = (files) =>
    files.filter((file) => {
      const fileName =
        file instanceof URL || typeof file === 'string' ? file.toString() : file.name;

      switch (assetType) {
        case 'usenet':
          return fileName?.endsWith('.nzb');
        case 'torrents':
          return fileName?.endsWith('.torrent');
        default:
          return false;
      }
    });

  const validateLink = (link) => {
    switch (assetType) {
      case 'torrents': {
        const magnetRegex = /magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i;
        return magnetRegex.test(link);
      }
      case 'webdl':
        try {
          new URL(link);
          return true;
        } catch {
          return false;
        }
      case 'usenet':
        try {
          new URL(link);
          return (
            link.includes('.nzb') ||
            link.includes('nzb.') ||
            link.includes('/nzb/') ||
            link.includes('usenet')
          );
        } catch {
          return false;
        }
      default:
        return false;
    }
  };

  useEffect(() => {
    setJSON(STORAGE_KEY, globalOptions);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('torrent-upload-options'));
    }
  }, [globalOptions]);

  useEffect(() => {
    setItem(SHOW_OPTIONS_KEY, showOptions);
  }, [showOptions]);

  const validateAndAddFiles = (newFiles) => {
    const validFiles = validateFiles(newFiles);
    const newItems = validFiles.map((file) => {
      const item = createFileItem(file);
      item.data = file;
      return item;
    });
    addItems(newItems);
  };

  const handleLinkInput = async (input) => {
    setLinkInput(input);

    const validLinks = input
      .split('\n')
      .filter((link) => link.trim())
      .filter((link) => validateLink(link.trim()));

    if (validLinks.length) {
      const links = await Promise.all(validLinks.map((link) => createLinkItem(link)));
      addItems(links);
      setLinkInput('');
    }
  };

  const updateGlobalOptions = (options) => {
    setGlobalOptions((prev) => {
      const newOptions = { ...prev, ...options };
      if (typeof newOptions.autoStartLimit !== 'number' || isNaN(newOptions.autoStartLimit)) {
        newOptions.autoStartLimit = 3;
      }
      return newOptions;
    });

    setItems(items.map((item) => (item.status === 'queued' ? { ...item, ...options } : item)));
  };

  return {
    items,
    setItems,
    linkInput,
    handleLinkInput,
    error,
    setError,
    isUploading,
    progress,
    setIsUploading,
    setProgress,
    updateItemStatus,
    validateAndAddFiles,
    globalOptions,
    updateGlobalOptions,
    showOptions,
    setShowOptions,
    webdlPassword,
    setWebdlPassword,
    assetType,
  };
}
