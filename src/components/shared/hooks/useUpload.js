'use client';

import { useState, useEffect } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';
import { useUploaderStore } from '@/store/uploaderStore';

// Rate limits: 10 per minute, 60 per hour
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Minimum delay between uploads to respect rate limits (6 seconds = 10 per minute)
const MIN_UPLOAD_DELAY_MS = 6000;

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

  // Rate limiting state
  const [rateLimitInfo, setRateLimitInfo] = useState({
    uploadsInLastMinute: [],
    uploadsInLastHour: [],
    waitTimeMs: 0,
    estimatedCompletionTime: null,
    isRateLimited: false,
  });

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
          const filenameParam = url.searchParams.get('filename') || 
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
        file instanceof URL || typeof file === 'string'
          ? file.toString()
          : file.name;

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

  // Calculate rate limit wait time
  const calculateWaitTime = (uploadsInLastMinute, uploadsInLastHour) => {
    const now = Date.now();
    
    // Clean old entries
    const recentMinute = uploadsInLastMinute.filter(
      (time) => now - time < MINUTE_MS
    );
    const recentHour = uploadsInLastHour.filter(
      (time) => now - time < HOUR_MS
    );

    let waitTime = 0;

    // Check per-minute limit
    if (recentMinute.length >= RATE_LIMIT_PER_MINUTE) {
      const oldestInMinute = Math.min(...recentMinute);
      waitTime = Math.max(waitTime, MINUTE_MS - (now - oldestInMinute));
    }

    // Check per-hour limit
    if (recentHour.length >= RATE_LIMIT_PER_HOUR) {
      const oldestInHour = Math.min(...recentHour);
      waitTime = Math.max(waitTime, HOUR_MS - (now - oldestInHour));
    }

    return {
      waitTimeMs: waitTime,
      uploadsInLastMinute: recentMinute,
      uploadsInLastHour: recentHour,
      isRateLimited: waitTime > 0,
    };
  };

  // Get available rate limit capacity
  const getAvailableCapacity = (uploadsInLastMinute, uploadsInLastHour) => {
    const now = Date.now();
    const recentMinute = uploadsInLastMinute.filter(
      (time) => now - time < MINUTE_MS
    );
    const recentHour = uploadsInLastHour.filter(
      (time) => now - time < HOUR_MS
    );

    const availablePerMinute = Math.max(0, RATE_LIMIT_PER_MINUTE - recentMinute.length);
    const availablePerHour = Math.max(0, RATE_LIMIT_PER_HOUR - recentHour.length);

    return Math.min(availablePerMinute, availablePerHour);
  };

  // Wait for rate limit if needed
  const waitForRateLimit = async (uploadsInLastMinute, uploadsInLastHour) => {
    const rateLimit = calculateWaitTime(uploadsInLastMinute, uploadsInLastHour);
    
    if (rateLimit.waitTimeMs > 0) {
      setRateLimitInfo({
        ...rateLimit,
        estimatedCompletionTime: null, // Will be calculated in uploadItems
      });
      await new Promise((resolve) => setTimeout(resolve, rateLimit.waitTimeMs));
    }

    return rateLimit;
  };

  // Upload a single item
  const uploadItem = async (item, uploadsInLastMinute, uploadsInLastHour) => {
    // Wait for rate limit before uploading
    const rateLimit = await waitForRateLimit(uploadsInLastMinute, uploadsInLastHour);
    let currentMinute = rateLimit.uploadsInLastMinute;
    let currentHour = rateLimit.uploadsInLastHour;

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
      formData.append('seed', item.seed);
      formData.append('allow_zip', item.allowZip);
    }

    // Add password if activeType is webdl
    if (assetType === 'webdl' && webdlPassword) {
      formData.append('password', webdlPassword);
    }

    // Add name if it exists
    if (item.name) {
      formData.append('name', item.name);
    }

    // Add common options
    if (globalOptions.asQueued) {
      formData.append('as_queued', item.asQueued);
    }

    let result;
    let retryCount = 0;
    const maxRetries = 3;

    // Handle 429 errors with exponential backoff
    while (retryCount < maxRetries) {
      result = await retryFetch(getApiEndpoint(item.type), {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData,
        permanent: [
          (data) =>
            Object.values(NON_RETRYABLE_ERRORS).some(
              (err) => data.error?.includes(err) || data.detail?.includes(err),
            ),
        ],
      });

      // If we get a 429 error, wait longer and retry
      if (!result.success && (result.error?.includes('429') || result.error?.includes('Too many requests'))) {
        retryCount++;
        if (retryCount < maxRetries) {
          // Exponential backoff: 30s, 60s, 120s
          const backoffDelay = 30000 * Math.pow(2, retryCount - 1);
          setRateLimitInfo((prev) => ({
            ...prev,
            waitTimeMs: backoffDelay,
            isRateLimited: true,
          }));
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }
      }

      break;
    }

    // Track successful upload for rate limiting
    if (result.success) {
      const now = Date.now();
      currentMinute = [...currentMinute, now];
      currentHour = [...currentHour, now];
      
      setRateLimitInfo((prev) => ({
        uploadsInLastMinute: currentMinute,
        uploadsInLastHour: currentHour,
        waitTimeMs: 0,
        isRateLimited: false,
        estimatedCompletionTime: prev.estimatedCompletionTime,
      }));
    }

    return { 
      ...result, 
      uploadsInLastMinute: currentMinute, 
      uploadsInLastHour: currentHour 
    };
  };

  // Upload a list of items
  const uploadItems = async () => {
    setIsUploading(true);
    const pendingItems = items.filter((item) => item.status === 'queued');
    setProgress({ current: 0, total: pendingItems.length });

    // Initialize rate limit tracking
    let currentUploadsInMinute = [...rateLimitInfo.uploadsInLastMinute];
    let currentUploadsInHour = [...rateLimitInfo.uploadsInLastHour];
    let processedCount = 0;

    // Calculate estimated completion time
    const calculateEstimatedTime = (remaining, uploadsInMinute, uploadsInHour) => {
      const now = Date.now();
      let estimatedMs = 0;
      let tempMinute = [...uploadsInMinute];
      let tempHour = [...uploadsInHour];

      for (let i = 0; i < remaining; i++) {
        const rateLimit = calculateWaitTime(tempMinute, tempHour);
        estimatedMs += rateLimit.waitTimeMs + MIN_UPLOAD_DELAY_MS;
        
        // Simulate adding upload timestamp
        const uploadTime = now + estimatedMs;
        tempMinute.push(uploadTime);
        tempHour.push(uploadTime);
        
        // Clean old entries
        tempMinute = tempMinute.filter((time) => uploadTime - time < MINUTE_MS);
        tempHour = tempHour.filter((time) => uploadTime - time < HOUR_MS);
      }

      return now + estimatedMs;
    };

    const estimatedCompletion = calculateEstimatedTime(
      pendingItems.length,
      currentUploadsInMinute,
      currentUploadsInHour
    );
    setRateLimitInfo((prev) => ({
      ...prev,
      estimatedCompletionTime: estimatedCompletion,
    }));

    // Process items sequentially to strictly respect rate limits
    // Process one at a time to avoid race conditions with concurrent uploads
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const idx = items.findIndex((x) => x === item);

      // Check available capacity before each upload
      const availableCapacity = getAvailableCapacity(currentUploadsInMinute, currentUploadsInHour);
      
      // If we're at the limit, wait before proceeding
      if (availableCapacity <= 0) {
        const rateLimit = calculateWaitTime(currentUploadsInMinute, currentUploadsInHour);
        
        if (rateLimit.waitTimeMs > 0) {
          setRateLimitInfo((prev) => ({
            ...prev,
            waitTimeMs: rateLimit.waitTimeMs,
            isRateLimited: true,
            estimatedCompletionTime: prev.estimatedCompletionTime,
          }));
          
          await new Promise((resolve) => setTimeout(resolve, rateLimit.waitTimeMs));
          
          // Clean old entries after waiting
          const now = Date.now();
          currentUploadsInMinute = currentUploadsInMinute.filter(
            (time) => now - time < MINUTE_MS
          );
          currentUploadsInHour = currentUploadsInHour.filter(
            (time) => now - time < HOUR_MS
          );
        }
      }

      updateItemStatus(idx, 'processing');

      const result = await uploadItem(item, currentUploadsInMinute, currentUploadsInHour);

      // Update rate limit tracking immediately after each upload
      if (result.uploadsInLastMinute) {
        currentUploadsInMinute = result.uploadsInLastMinute;
      }
      if (result.uploadsInLastHour) {
        currentUploadsInHour = result.uploadsInLastHour;
      }

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

      // Update rate limit info after each upload
      const rateLimit = calculateWaitTime(currentUploadsInMinute, currentUploadsInHour);
      const remaining = pendingItems.length - processedCount;
      const newEstimated = remaining > 0 
        ? calculateEstimatedTime(remaining, currentUploadsInMinute, currentUploadsInHour) 
        : null;
      
      setRateLimitInfo({
        uploadsInLastMinute: currentUploadsInMinute,
        uploadsInLastHour: currentUploadsInHour,
        waitTimeMs: rateLimit.waitTimeMs,
        isRateLimited: rateLimit.isRateLimited,
        estimatedCompletionTime: newEstimated,
      });

      // Add minimum delay between uploads (except for the last one)
      if (i < pendingItems.length - 1) {
        // Check if we need to wait due to rate limits
        const nextAvailableCapacity = getAvailableCapacity(currentUploadsInMinute, currentUploadsInHour);
        
        if (nextAvailableCapacity <= 0) {
          // Will wait in next iteration's rate limit check
          continue;
        }
        
        // Otherwise, wait the minimum delay
        await new Promise((resolve) => setTimeout(resolve, MIN_UPLOAD_DELAY_MS));
      }
    }

    setIsUploading(false);
    setRateLimitInfo((prev) => ({
      ...prev,
      estimatedCompletionTime: null,
      waitTimeMs: 0,
      isRateLimited: false,
    }));
  };

  // Update global upload options
  const updateGlobalOptions = (options) => {
    setGlobalOptions((prev) => {
      const newOptions = { ...prev, ...options };

      // Ensure autoStartLimit has a valid value
      if (
        typeof newOptions.autoStartLimit !== 'number' ||
        isNaN(newOptions.autoStartLimit)
      ) {
        newOptions.autoStartLimit = 3;
      }

      return newOptions;
    });

    // Apply to all queued items
    setItems(
      items.map((item) =>
        item.status === 'queued' ? { ...item, ...options } : item,
      ),
    );
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
            (err) => data.error?.includes(err) || data.detail?.includes(err),
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
            (err) => data.error?.includes(err) || data.detail?.includes(err),
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
    rateLimitInfo,
  };
};

const isNonRetryableError = (data) => {
  return (
    !data.success &&
    (Object.values(NON_RETRYABLE_ERRORS).includes(data.error) ||
      Object.values(NON_RETRYABLE_ERRORS).some((err) =>
        data.detail?.includes(err),
      ))
  );
};
