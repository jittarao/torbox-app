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

const createTorrentItem = (file) => {
  if (file instanceof URL || typeof file === 'string') {
    const url = file.toString();
    return {
      type: 'torrent',
      name: url.split('/').pop() || url,
      data: url,
      status: 'queued',
      seed: 1,
      allowZip: true,
      asQueued: false
    };
  }
  return {
    type: 'torrent',
    name: file.name,
    data: file,
    status: 'queued',
    seed: 1,
    allowZip: true,
    asQueued: false
  };
};

const createMagnetItem = (magnetUrl) => ({
  type: 'magnet',
  name: magnetUrl.substring(0, 60) + '...',
  data: magnetUrl,
  status: 'queued',
  seed: 1,
  allowZip: true,
  asQueued: false
});

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

  // Update createTorrentItem and createMagnetItem to use global options
  const createItemWithOptions = (item) => ({
    ...item,
    ...globalOptions // Apply current global options to new items
  });

  const validateAndAddFiles = (newFiles) => {
    const validFiles = newFiles
      .filter(file => {
        if (file instanceof URL || typeof file === 'string') {
          return file.toString().endsWith('.torrent');
        }
        return file.name?.endsWith('.torrent');
      })
      .map(file => createItemWithOptions(createTorrentItem(file)));

    const totalItems = items.filter(item => item.status === 'queued').length + validFiles.length;
    
    if (totalItems > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }
    
    setItems(prev => [...prev, ...validFiles]);
    setError('');
  };

  const handleMagnetInput = (input) => {
    setMagnetInput(input);
    
    // Process input when Enter is pressed or on paste
    const magnetLinks = input
      .split('\n')
      .filter(link => link.trim())
      .filter(link => validateMagnetLink(link.trim()))
      .map(link => createItemWithOptions(createMagnetItem(link)));

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

    // Process items in chunks
    for (let i = 0; i < pendingItems.length; i += CONCURRENT_UPLOADS) {
      const chunk = pendingItems.slice(i, i + CONCURRENT_UPLOADS);
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          const itemIndex = items.findIndex(x => x === item);
          
          // Set item to processing state
          setItems(prev => prev.map((x, idx) => 
            idx === itemIndex ? { ...x, status: 'processing' } : x
          ));
          
          // Try upload with retries
          let retries = 0;
          while (retries < MAX_RETRIES) {
            const result = await uploadItem(item);
            
            if (result.success) {
              setItems(prev => prev.map((x, idx) => 
                idx === itemIndex ? { ...x, status: 'success' } : x
              ));
              setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              return true;
            }
            
            // If non-retryable error, fail immediately
            if (isNonRetryableError({ detail: result.error })) {
              setItems(prev => prev.map((x, idx) => 
                idx === itemIndex ? { ...x, status: 'error' } : x
              ));
              setError(result.error);
              return false;
            }
            
            retries++;
            if (retries < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
          
          // Max retries reached
          setItems(prev => prev.map((x, idx) => 
            idx === itemIndex ? { ...x, status: 'error' } : x
          ));
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