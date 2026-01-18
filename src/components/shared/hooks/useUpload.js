'use client';

import { useState, useEffect } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';
import { useUploaderStore } from '@/store/uploaderStore';

// Local storage keys
const STORAGE_KEY = 'torrent-upload-options';
const SHOW_OPTIONS_KEY = 'uploader-options-expanded';

// Default options to apply to all uploaded assets + auto start options
const DEFAULT_OPTIONS = {
  seed: 1,
  allowZip: true,
  asQueued: false,
  autoStart: false,
  autoStartLimit: 3,
};

export const useUpload = (apiKey, assetType = 'torrents') => {
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
  } = useUploaderStore();

  const [linkInput, setLinkInput] = useState(''); // Input for links (magnet, nzb, webdl)
  const [isClient, setIsClient] = useState(false); // Track if component is mounted
  const [webdlPassword, setWebdlPassword] = useState(''); // Add password state

  // Global upload options to apply to all uploaded assets + auto start options
  const [globalOptions, setGlobalOptions] = useState(DEFAULT_OPTIONS);

  // Show/hide options state
  const [showOptions, setShowOptions] = useState(false);

  // Initialize from localStorage after component is mounted
  useEffect(() => {
    setIsClient(true);

    // Load global options from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setGlobalOptions(JSON.parse(saved));
      }
    } catch (err) {
      console.warn(`Failed to load ${assetType} upload options:`, err);
    }

    // Load show/hide options from localStorage
    try {
      const showOptionsValue = localStorage.getItem(SHOW_OPTIONS_KEY);
      if (showOptionsValue !== null) {
        setShowOptions(showOptionsValue === 'true');
      }
    } catch (err) {
      console.warn(`Failed to load ${assetType} options visibility:`, err);
    }
  }, [assetType]);

  // Get API endpoint based on asset type
  const getApiEndpoint = (activeType = assetType) => {
    switch (activeType) {
      case 'usenet':
        return '/api/usenet';
      case 'webdl':
        return '/api/webdl';
      default:
        return '/api/torrents';
    }
  };

  // Create base item with default status and global options
  const createBaseItem = (data, type) => ({
    type, // "torrent", "magnet", "usenet", or "webdl". Used internally.
    status: 'queued', // "queued", "processing", "success", or "error". Used internally.
    data, // URL or file to upload
    ...globalOptions, // Apply current global upload options directly
  });

  // Create item from file or link
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

  // Create link item from link
  const createLinkItem = async (link) => {
    let name = link.substring(0, 60) + '...';

    // For usenet links, try to extract a better filename
    if (assetType === 'usenet') {
      try {
        // Check if it's an NZB API link that might have content disposition
        if (link.includes('api') && (link.includes('nzb') || link.includes('usenet'))) {
          // Try to extract filename from URL parameters first
          const url = new URL(link);
          const filenameParam =
            url.searchParams.get('filename') ||
            url.searchParams.get('name') ||
            url.searchParams.get('title');

          if (filenameParam) {
            name = decodeURIComponent(filenameParam);
          } else {
            // For API links without explicit filename, let the server extract from content disposition
            // Use a generic name that won't interfere with server-side filename extraction
            const domain = url.hostname.replace('www.', '');
            name = `${domain} - NZB Download`;
          }
        } else if (link.includes('.nzb')) {
          // For direct .nzb file links, extract filename from URL
          const url = new URL(link);
          const pathParts = url.pathname.split('/');
          const filename = pathParts[pathParts.length - 1];
          if (filename && filename.endsWith('.nzb')) {
            name = filename.replace('.nzb', '');
          }
        }
      } catch (error) {
        console.warn('Failed to parse usenet link for filename:', error);
        // Fall back to default name generation
      }
    }

    return {
      ...createBaseItem(link, assetType === 'torrents' ? 'magnet' : assetType),
      name,
    };
  };

  // Validate files based on asset type
  const validateFiles = (files) => {
    return files.filter((file) => {
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
  };

  // Validate link based on asset type
  const validateLink = (link) => {
    switch (assetType) {
      case 'torrents':
        // Magnet link validation
        const magnetRegex = /magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i;
        return magnetRegex.test(link);
      case 'webdl':
        // Basic URL validation for web downloads
        try {
          new URL(link);
          return true;
        } catch (e) {
          return false;
        }
      case 'usenet':
        // Basic URL validation for NZB links
        try {
          new URL(link);
          return (
            link.includes('.nzb') ||
            link.includes('nzb.') ||
            link.includes('/nzb/') ||
            link.includes('usenet')
          );
        } catch (e) {
          return false;
        }
      default:
        return false;
    }
  };

  // Save global upload options to localStorage whenever they change
  useEffect(() => {
    if (!isClient) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalOptions));
    } catch (err) {
      console.warn(`Failed to save ${assetType} upload options:`, err);
    }
  }, [globalOptions, assetType, isClient]);

  // Save show/hide options to localStorage whenever they change
  useEffect(() => {
    if (!isClient) return;

    try {
      localStorage.setItem(SHOW_OPTIONS_KEY, showOptions);
    } catch (err) {
      console.warn(`Failed to save ${assetType} options visibility:`, err);
    }
  }, [showOptions, assetType, isClient]);

  // Validate and add files to the upload list
  const validateAndAddFiles = (newFiles) => {
    const validFiles = validateFiles(newFiles);

    // Create items with the file data properly assigned
    const newItems = validFiles.map((file) => {
      const item = createFileItem(file);
      // Store file in data property for consistency
      item.data = file;
      return item;
    });

    addItems(newItems);
  };

  // Handle link input
  const handleLinkInput = async (input) => {
    setLinkInput(input);

    // Process input and extract links when Enter is pressed or on paste
    const validLinks = input
      .split('\n')
      .filter((link) => link.trim())
      .filter((link) => validateLink(link.trim()));

    if (validLinks.length) {
      const links = await Promise.all(validLinks.map((link) => createLinkItem(link)));
      addItems(links);
      setLinkInput(''); // Clear input after successful addition
    }
  };

  // Upload a single item
  const uploadItem = async (item) => {
    const formData = new FormData();

    // Handle different item types
    if (item.type === 'magnet') {
      formData.append('magnet', item.data);
    } else {
      // Handle torrent, usenet and webdl type
      if (typeof item.data === 'string') {
        formData.append('link', item.data);
      } else {
        formData.append('file', item.data);
      }
    }

    if (item.type === 'torrent' || item.type === 'magnet') {
      // Use nullish coalescing to get defaults from globalOptions or DEFAULT_OPTIONS
      const seedValue = item.seed ?? globalOptions.seed ?? DEFAULT_OPTIONS.seed;
      const allowZipValue = item.allowZip ?? globalOptions.allowZip ?? DEFAULT_OPTIONS.allowZip;
      formData.append('seed', seedValue);
      formData.append('allow_zip', allowZipValue);
    }

    // Add password if activeType is webdl
    if (assetType === 'webdl' && webdlPassword) {
      formData.append('password', webdlPassword);
    }

    // Add name if it exists
    if (item.name) {
      formData.append('name', item.name);
    }

    // Add as_queued only if it's true
    if (item.asQueued === true || item.asQueued === 'true') {
      formData.append('as_queued', 'true');
    }

    // Queue upload via NextJS API (which handles backend queuing)
    const result = await retryFetch(getApiEndpoint(item.type), {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData,
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ),
      ],
    });

    // The upload is queued and will be processed in the background by the backend
    return result;
  };

  // Batch upload items (for large batches)
  const uploadItemsBatch = async (itemsToUpload) => {
    const batchEndpoint = '/api/uploads/batch';

    // Prepare uploads for batch API
    const uploads = await Promise.all(
      itemsToUpload.map(async (item) => {
        const upload = {
          type: assetType === 'torrents' ? 'torrent' : assetType,
          upload_type:
            item.type === 'magnet' ? 'magnet' : typeof item.data === 'string' ? 'link' : 'file',
          name: item.name || 'Unknown',
        };

        // Handle file uploads - convert to base64
        if (upload.upload_type === 'file' && item.data instanceof File) {
          const arrayBuffer = await item.data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          upload.file_data = buffer.toString('base64');
          upload.filename = item.data.name;
        } else if (upload.upload_type === 'magnet' || upload.upload_type === 'link') {
          upload.url = item.data;
        }

        // Add type-specific options
        // Check if it's a torrent/magnet upload (either by item.type or assetType)
        if (
          item.type === 'torrent' ||
          item.type === 'magnet' ||
          assetType === 'torrents' ||
          upload.type === 'torrent'
        ) {
          // Use nullish coalescing to preserve 0 values, but default to 1 if undefined
          // seed: 1 = Auto, 2 = Seed, 3 = Don't Seed
          upload.seed = item.seed ?? globalOptions.seed ?? 1;
          // allow_zip: default to true if not set
          upload.allow_zip = item.allowZip ?? globalOptions.allowZip ?? true;
        }

        if (assetType === 'webdl' && webdlPassword) {
          upload.password = webdlPassword;
        }

        // Only include as_queued if it's true
        if (item.asQueued === true || item.asQueued === 'true') {
          upload.as_queued = true;
        }

        return upload;
      })
    );

    const result = await retryFetch(batchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ uploads }),
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ),
      ],
    });

    return result;
  };

  // Upload a list of items
  const uploadItems = async () => {
    setIsUploading(true);
    const pendingItems = items.filter((item) => item.status === 'queued');
    setProgress({ current: 0, total: pendingItems.length });

    const BATCH_THRESHOLD = 10; // Use batch API for 10+ items

    // Use batch upload for large batches
    if (pendingItems.length >= BATCH_THRESHOLD) {
      // Mark all as processing
      pendingItems.forEach((item) => {
        const idx = items.findIndex((x) => x === item);
        updateItemStatus(idx, 'processing');
      });

      const result = await uploadItemsBatch(pendingItems);

      // retryFetch returns { success: true, data: <api_response> }
      // API response is { success: true, data: { uploads: [...] } }
      // Handle both result.data.uploads and result.data.data.uploads
      const responseData = result.data?.data || result.data;
      const uploads = responseData?.uploads || [];
      const errors = responseData?.errors || [];

      if (result.success && uploads.length > 0) {
        // Map results back to items by matching index (most reliable)
        // The backend returns uploads in the same order as sent
        pendingItems.forEach((item, index) => {
          const idx = items.findIndex((x) => x === item);
          if (uploads[index]) {
            // Successfully uploaded
            updateItemStatus(idx, 'success');
          } else {
            // Check if there's an error for this item
            const error = errors.find((e) => {
              // Try to match by name or index
              return (
                e.upload?.name === item.name ||
                e.index === index ||
                (e.upload && JSON.stringify(e.upload) === JSON.stringify(item))
              );
            });
            updateItemStatus(idx, 'error', error?.error || 'Upload failed');
          }
        });

        setProgress({
          current: uploads.length,
          total: pendingItems.length,
        });

        if (errors.length > 0) {
          setError(`${errors.length} upload(s) failed`);
        } else {
          setError(null);
        }
      } else if (result.success) {
        // Success response - try to match by name as fallback if index matching didn't work
        const uploadMap = new Map();
        uploads.forEach((upload) => {
          const matchingItem = pendingItems.find((item) => item.name === upload.name);
          if (matchingItem) {
            uploadMap.set(matchingItem, upload);
          }
        });

        pendingItems.forEach((item) => {
          const idx = items.findIndex((x) => x === item);
          if (uploadMap.has(item)) {
            updateItemStatus(idx, 'success');
          } else {
            const error = errors.find((e) => e.upload?.name === item.name);
            updateItemStatus(idx, 'error', error?.error || 'Upload failed');
          }
        });

        setProgress({
          current: uploads.length,
          total: pendingItems.length,
        });

        if (errors.length > 0) {
          setError(`${errors.length} upload(s) failed`);
        } else {
          setError(null);
        }
      } else {
        // Batch failed - mark all as error
        pendingItems.forEach((item) => {
          const idx = items.findIndex((x) => x === item);
          updateItemStatus(idx, 'error', result.error || 'Batch upload failed');
        });
        setError(result.userMessage || result.error || 'Batch upload failed');
      }
    } else {
      // Use individual uploads for small batches
      let processedCount = 0;

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];
        const idx = items.findIndex((x) => x === item);

        updateItemStatus(idx, 'processing');

        const result = await uploadItem(item);

        if (result.success) {
          updateItemStatus(idx, 'success');
          processedCount++;
          setProgress({
            current: processedCount,
            total: pendingItems.length,
          });

          // Clear any previous errors on success
          setError(null);
        } else {
          updateItemStatus(idx, 'error', result.error);
          setError(result.userMessage || result.error);
          // Continue processing other items even if one fails
        }
      }
    }

    setIsUploading(false);
  };

  // Update global upload options
  const updateGlobalOptions = (options) => {
    setGlobalOptions((prev) => {
      const newOptions = { ...prev, ...options };

      // Ensure autoStartLimit has a valid value
      if (typeof newOptions.autoStartLimit !== 'number' || isNaN(newOptions.autoStartLimit)) {
        newOptions.autoStartLimit = 3;
      }

      return newOptions;
    });

    // Apply to all queued items
    setItems(items.map((item) => (item.status === 'queued' ? { ...item, ...options } : item)));
  };

  // Control queued items. Operation can be start
  const controlQueuedItem = async (queuedId, operation) => {
    const result = await retryFetch(`${getApiEndpoint()}/controlqueued`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: {
        queued_id: queuedId,
        operation,
        type: assetType === 'torrents' ? 'torrent' : assetType,
      },
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ),
      ],
    });

    return result;
  };

  // Control active torrents. Operation can be stop_seeding
  const controlTorrent = async (torrent_id, operation) => {
    const result = await retryFetch('/api/torrents/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: {
        torrent_id,
        operation,
      },
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ),
      ],
    });

    return result;
  };

  return {
    items,
    setItems,
    linkInput,
    setLinkInput: handleLinkInput,
    error,
    setError,
    isUploading,
    progress,
    validateAndAddFiles,
    uploadItem,
    uploadItems,
    removeItem: useUploaderStore((state) => state.removeItem),
    resetUploader: useUploaderStore((state) => state.resetUploader), // Currently not used
    globalOptions,
    updateGlobalOptions,
    showOptions,
    setShowOptions,
    controlTorrent,
    controlQueuedItem,
    assetType,
    webdlPassword,
    setWebdlPassword,
  };
};

const isNonRetryableError = (data) => {
  return (
    !data.success &&
    (Object.values(NON_RETRYABLE_ERRORS).includes(data.error) ||
      Object.values(NON_RETRYABLE_ERRORS).some((err) => data.detail?.includes(err)))
  );
};
