import { useState, useEffect } from 'react';
import { NON_RETRYABLE_ERRORS } from '../../constants';

const RETRY_DELAY = 2000;
const MAX_RETRIES = 3;
const MAX_FILES = 50;
const STORAGE_KEY = 'torrent-upload-options';
const SHOW_OPTIONS_KEY = 'torrent-upload-show-options';
const CONCURRENT_UPLOADS = 3;

// Move default options to a constant
const DEFAULT_OPTIONS = {
  seed: 1,
  allowZip: true,
  asQueued: false,
  autoStart: false,
  autoStartLimit: 3
};

export const useTorrentUpload = (apiKey) => {
  const [items, setItems] = useState([]);
  const [magnetInput, setMagnetInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [globalOptions, setGlobalOptions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_OPTIONS;
    } catch (err) {
      console.warn('Failed to load upload options:', err);
      return DEFAULT_OPTIONS;
    }
  });
  const [showOptions, setShowOptions] = useState(() => {
    try {
      return localStorage.getItem(SHOW_OPTIONS_KEY) === 'true'; // Default to false
    } catch {
      return false;
    }
  });

  const createBaseItem = (data, type) => ({
    type,
    data,
    status: 'queued',
    ...globalOptions // Apply current global options directly
  });
  
  const createTorrentItem = (file) => {
    if (file instanceof URL || typeof file === 'string') {
      const url = file.toString();
      return {
        ...createBaseItem(url, 'torrent'),
        name: url.split('/').pop() || url,
      };
    }
    return {
      ...createBaseItem(file, 'torrent'),
      name: file.name,
    };
  };
  
  const createMagnetItem = (magnetUrl) => ({
    ...createBaseItem(magnetUrl, 'magnet'),
    name: magnetUrl.substring(0, 60) + '...',
  });

  // Save options to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalOptions));
    } catch (err) {
      console.warn('Failed to save upload options:', err);
    }
  }, [globalOptions]);

  // Add effect to save show/hide state
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_OPTIONS_KEY, showOptions);
    } catch (err) {
      console.warn('Failed to save options visibility:', err);
    }
  }, [showOptions]);

  const validateAndAddFiles = (newFiles) => {
    const queuedCount = items.reduce((count, item) => 
      item.status === 'queued' ? count + 1 : count, 0);
      
    const validFiles = newFiles.filter(file => {
      const fileName = file instanceof URL || typeof file === 'string' 
        ? file.toString() 
        : file.name;
      return fileName?.endsWith('.torrent');
    });

    if (queuedCount + validFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }
    
    setItems(prev => [...prev, ...validFiles.map(createTorrentItem)]);
    setError('');
  };

  const handleMagnetInput = (input) => {
    setMagnetInput(input);
    
    // Process input when Enter is pressed or on paste
    const magnetLinks = input
      .split('\n')
      .filter(link => link.trim())
      .filter(link => validateMagnetLink(link.trim()))
      .map(link => createMagnetItem(link));

    if (magnetLinks.length) {
      const totalItems = items.filter(item => item.status === 'queued').length + magnetLinks.length;
      
      if (totalItems > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      setItems(prev => [...prev, ...magnetLinks]);
      setMagnetInput(''); // Clear input after successful addition
    }
  };

  const validateMagnetLink = (link) => {
    const magnetRegex = /magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32}/i;
    return magnetRegex.test(link);
  };

  const uploadItem = async (item) => {
    const formData = new FormData();
    if (item.type === 'magnet') {
      formData.append('magnet', item.data);
    } else {
      if (typeof item.data === 'string') {
        formData.append('url', item.data);
      } else {
        formData.append('file', item.data);
      }
    }
    
    formData.append('seed', item.seed);
    formData.append('allow_zip', item.allowZip);
    formData.append('as_queued', item.asQueued);

    try {
      const response = await fetch('/api/torrents', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
        body: formData
      });

      const data = await response.json();
      return data.success ? 
        { success: true } : 
        { success: false, error: data.detail };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const uploadTorrents = async () => {
    setUploading(true);
    const pendingItems = items.filter(item => item.status === 'queued');
    setProgress({ current: 0, total: pendingItems.length });

    // Process items in chunks more efficiently
    const chunks = Array(Math.ceil(pendingItems.length / CONCURRENT_UPLOADS))
      .fill()
      .map((_, i) => pendingItems.slice(i * CONCURRENT_UPLOADS, (i + 1) * CONCURRENT_UPLOADS));

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          const itemIndex = items.findIndex(x => x === item);
          
          // Batch state updates
          setItems(prev => {
            const newItems = [...prev];
            newItems[itemIndex] = { ...newItems[itemIndex], status: 'processing' };
            return newItems;
          });

          // Try upload with retries
          for (let retries = 0; retries < MAX_RETRIES; retries++) {
            const result = await uploadItem(item);
            
            if (result.success) {
              setItems(prev => {
                const newItems = [...prev];
                newItems[itemIndex] = { ...newItems[itemIndex], status: 'success' };
                return newItems;
              });
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              return true;
            }
            
            // If non-retryable error, fail immediately
            if (isNonRetryableError({ detail: result.error })) {
              setItems(prev => {
                const newItems = [...prev];
                newItems[itemIndex] = { ...newItems[itemIndex], status: 'error' };
                return newItems;
              });
              setError(result.error);
              return false;
            }
            
            if (retries < MAX_RETRIES - 1) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
          
          // Max retries reached
          setItems(prev => {
            const newItems = [...prev];
            newItems[itemIndex] = { ...newItems[itemIndex], status: 'error' };
            return newItems;
          });
          setError(`Failed after ${MAX_RETRIES} attempts`);
          return false;
        })
      );

      // Stop if any upload failed after retries
      if (chunkResults.includes(false)) break;
    }

    setUploading(false);
  };

  const resetUploader = () => {
    setItems([]);
    setMagnetInput('');
    setError('');
    setProgress({ current: 0, total: 0 });
    // Don't reset global options since they should persist
  };

  const updateItemOptions = (index, options) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, ...options } : item
    ));
  };

  const updateGlobalOptions = (options) => {
    setGlobalOptions(prev => {
      const newOptions = { ...prev, ...options };
      
      // Ensure autoStartLimit has a valid value
      if (typeof newOptions.autoStartLimit !== 'number' || isNaN(newOptions.autoStartLimit)) {
        newOptions.autoStartLimit = 3;
      }
      
      return newOptions;
    });
    
    // Apply to all queued items
    setItems(prev => prev.map(item => 
      item.status === 'queued' ? { ...item, ...options } : item
    ));
  };

  const controlQueuedTorrent = async (queuedId, operation) => {
    try {
      const response = await fetch('/api/torrents/controlqueued', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          queued_id: queuedId,
          operation,
          type: 'torrent'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to control torrent');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const controlTorrent = async (torrent_id, operation) => {
    try {
      const response = await fetch('/api/torrents/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          torrent_id,
          operation
        })
      });

      if (!response.ok) {
        throw new Error('Failed to control torrent');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return {
    items,
    magnetInput,
    uploading,
    progress,
    error,
    setMagnetInput: handleMagnetInput,
    validateAndAddFiles,
    uploadItem,
    uploadTorrents,
    removeItem: (index) => setItems(prev => prev.filter((_, i) => i !== index)),
    resetUploader,
    globalOptions,
    updateGlobalOptions,
    updateItemOptions,
    showOptions,
    setShowOptions,
    controlTorrent,
    controlQueuedTorrent,
  };
};

const isNonRetryableError = (data) => {
  return !data.success && (
    Object.values(NON_RETRYABLE_ERRORS).includes(data.error) ||
    Object.values(NON_RETRYABLE_ERRORS).some(err => data.detail?.includes(err))
  );
}; 