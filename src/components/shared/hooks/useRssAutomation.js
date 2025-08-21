import { useState, useEffect, useCallback, useRef } from 'react';
import { useUpload } from './useUpload';

// Automation processing interval (5 minutes)
const AUTOMATION_INTERVAL = 5 * 60 * 1000;

export function useRssAutomation(apiKey) {
  const [automationRules, setAutomationRules] = useState([]);
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [lastProcessed, setLastProcessed] = useState(null);
  const [processedCount, setProcessedCount] = useState(0);
  const intervalRef = useRef(null);
  const { uploadItem } = useUpload(apiKey);

  // Fetch automation rules
  const fetchAutomationRules = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await fetch('/api/rss/automation', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAutomationRules(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching automation rules:', error);
    }
  }, [apiKey]);

  // Process RSS automation
  const processAutomation = useCallback(async () => {
    if (!apiKey || automationRules.length === 0) return;

    setProcessingStatus('processing');
    let processed = 0;

    try {
      // Get enabled rules
      const enabledRules = automationRules.filter(rule => rule.enabled);
      
      for (const rule of enabledRules) {
        try {
          // Fetch RSS items for this feed
          const itemsResponse = await fetch(`/api/rss/items?feed_id=${rule.feed_id}&limit=100`, {
            headers: {
              'x-api-key': apiKey,
            },
          });

          if (!itemsResponse.ok) continue;

          const itemsData = await itemsResponse.json();
          if (!itemsData.success || !itemsData.data) continue;

          const items = itemsData.data;
          
          // Filter items based on rule criteria
          const matchingItems = items.filter(item => {
            // Check age filter
            if (rule.age_hours) {
              const itemDate = new Date(item.pubDate || item.date);
              const cutoffDate = new Date(Date.now() - rule.age_hours * 60 * 60 * 1000);
              if (itemDate < cutoffDate) return false;
            }

            // Check title pattern
            if (rule.title_pattern) {
              try {
                const titleRegex = new RegExp(rule.title_pattern, 'i');
                if (!titleRegex.test(item.title)) return false;
              } catch (error) {
                console.error('Invalid title regex:', rule.title_pattern);
                return false;
              }
            }

            // Check category pattern
            if (rule.category_pattern && item.category) {
              try {
                const categoryRegex = new RegExp(rule.category_pattern, 'i');
                if (!categoryRegex.test(item.category)) return false;
              } catch (error) {
                console.error('Invalid category regex:', rule.category_pattern);
                return false;
              }
            }

            // Check size filters
            if (rule.size_min && item.size) {
              const minSizeGB = parseFloat(rule.size_min) * 1024 * 1024 * 1024;
              if (item.size < minSizeGB) return false;
            }

            if (rule.size_max && item.size) {
              const maxSizeGB = parseFloat(rule.size_max) * 1024 * 1024 * 1024;
              if (item.size > maxSizeGB) return false;
            }

            return true;
          });

          // Process matching items
          for (const item of matchingItems) {
            if (!item.link) continue;

            try {
              // Determine download type
              const downloadType = rule.download_type || 'auto';
              let uploadType = 'torrent';
              
              if (item.link.includes('magnet:')) {
                uploadType = 'torrent';
              } else if (item.link.includes('.nzb')) {
                uploadType = 'usenet';
              } else {
                uploadType = 'webdl';
              }

              // Prepare upload data
              const uploadData = {
                type: uploadType,
                data: item.link,
                name: item.title,
                seed: rule.seed_time || 1,
                allowZip: true,
                asQueued: downloadType === 'queued',
              };

              // Add password for webdl if available
              if (uploadType === 'webdl' && item.password) {
                uploadData.password = item.password;
              }

              // Upload the item
              const result = await uploadItem(uploadData);
              
              if (result.success) {
                processed++;
                
                // Send notification if enabled
                if (rule.notification) {
                  // You can implement notification logic here
                  console.log(`Automation: Downloaded ${item.title}`);
                }
              }
            } catch (error) {
              console.error('Error processing automation item:', error);
            }
          }

          // Update rule last run time
          await fetch('/api/rss/automation', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({
              id: rule.id,
              last_run: new Date().toISOString(),
              downloads_count: (rule.downloads_count || 0) + processed,
            }),
          });

        } catch (error) {
          console.error('Error processing automation rule:', error);
        }
      }

      setProcessedCount(processed);
      setLastProcessed(new Date());
    } catch (error) {
      console.error('Error in automation processing:', error);
    } finally {
      setProcessingStatus('idle');
    }
  }, [apiKey, automationRules, uploadItem]);

  // Start automation processing
  const startAutomation = useCallback(() => {
    if (intervalRef.current) return;

    // Process immediately
    processAutomation();

    // Set up interval for periodic processing
    intervalRef.current = setInterval(processAutomation, AUTOMATION_INTERVAL);
  }, [processAutomation]);

  // Stop automation processing
  const stopAutomation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProcessingStatus('idle');
  }, []);

  // Manual trigger
  const triggerAutomation = useCallback(() => {
    processAutomation();
  }, [processAutomation]);

  // Initialize
  useEffect(() => {
    fetchAutomationRules();
  }, [fetchAutomationRules]);

  // Start automation when rules are loaded
  useEffect(() => {
    if (automationRules.length > 0) {
      startAutomation();
    }

    return () => {
      stopAutomation();
    };
  }, [automationRules, startAutomation, stopAutomation]);

  return {
    automationRules,
    processingStatus,
    lastProcessed,
    processedCount,
    triggerAutomation,
    startAutomation,
    stopAutomation,
    refreshRules: fetchAutomationRules,
  };
}
