import { useEffect, useRef } from 'react';
import { useUpload } from './useUpload';
import { deleteItemHelper } from '@/utils/deleteHelpers';
import { useArchive } from '@/hooks/useArchive';

const compareValues = (value1, operator, value2) => {
  switch (operator) {
    case 'gt':
      return value1 > value2;
    case 'lt':
      return value1 < value2;
    case 'gte':
      return value1 >= value2;
    case 'lte':
      return value1 <= value2;
    case 'eq':
      return value1 === value2;
    default:
      return false;
  }
};

export function useAutomationRules(items, apiKey, activeType) {
  const rulesRef = useRef([]);
  const intervalsRef = useRef({});
  const itemsRef = useRef(items); // Keep track of items
  const initializationRef = useRef(false); // Track if we've initialized

  const { controlTorrent, controlQueuedItem } = useUpload(apiKey);
  const { archiveDownload } = useArchive(apiKey);

  // Helper functions for rule metadata
  const getRuleMetadata = (rule, now = Date.now()) => {
    return (
      rule.metadata || {
        executionCount: 0,
        lastExecutedAt: null,
        triggeredCount: 0,
        lastTriggeredAt: null,
        lastEnabledAt: now,
        createdAt: now,
        updatedAt: now,
      }
    );
  };

  const updateRuleMetadata = (ruleId, updates) => {
    // Update rule metadata in storage
    const updatedRules = rulesRef.current.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            metadata: {
              ...getRuleMetadata(rule),
              ...updates,
            },
          }
        : rule,
    );
    localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    rulesRef.current = updatedRules;
    return updatedRules.find((r) => r.id === ruleId);
  };

  const executeRule = async (rule, unfilteredItems) => {
    // Skip execution if not for torrents
    if (activeType !== 'torrents') {
      return;
    }

    const items = unfilteredItems.filter((item) =>
      item.hasOwnProperty('active'),
    );
    // Check if rule should execute

    if (!rule.enabled) {
      // Skip disabled rules
      return;
    }

    const now = Date.now();

    // Find items that meet the conditions
    const matchingItems = items.filter((item) => {
      const conditions = rule.conditions || [rule.condition]; // Support both new and old format
      const logicOperator = rule.logicOperator || 'and'; // Default to AND
      
      const conditionResults = conditions.map((condition) => {
        let conditionValue = 0;
        switch (condition.type) {
          case 'seeding_time':
            if (!item.active) return false;
            conditionValue =
              (now - new Date(item.cached_at).getTime()) / (1000 * 60 * 60);
            break;
          case 'stalled_time':
            if (
              ['stalled', 'stalledDL', 'stalled (no seeds)'].includes(
                item.download_state,
              ) &&
              item.active
            ) {
              conditionValue =
                (now - new Date(item.updated_at).getTime()) / (1000 * 60 * 60);
            } else {
              return false;
            }
            break;
          case 'seeding_ratio':
            if (!item.active) return false;
            conditionValue = item.ratio;
            break;
          case 'seeds':
            conditionValue = item.seeds || 0;
            break;
          case 'peers':
            conditionValue = item.peers || 0;
            break;
          case 'download_speed':
            conditionValue = (item.download_speed || 0) / 1024; // Convert to KB/s
            break;
          case 'upload_speed':
            conditionValue = (item.upload_speed || 0) / 1024; // Convert to KB/s
            break;
          case 'file_size':
            conditionValue = (item.size || 0) / (1024 * 1024 * 1024); // Convert to GB
            break;
          case 'age':
            conditionValue = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60); // Hours since created
            break;
          case 'tracker':
            // For tracker, we'll do a string comparison instead of numeric
            const trackerUrl = item.tracker || '';
            conditionValue = trackerUrl.includes(condition.value) ? 1 : 0;
            break;
        }

        const conditionMet = compareValues(
          conditionValue,
          condition.operator,
          condition.value,
        );

        // Check if condition is met

        return conditionMet;
      });

      // Apply logic operator
      if (logicOperator === 'or') {
        return conditionResults.some(result => result);
      } else {
        return conditionResults.every(result => result);
      }
    });

    if (matchingItems.length === 0) {
      // No items match the rule conditions
      return;
    }

    // Update trigger metadata once per execution, not per item
    updateRuleMetadata(rule.id, {
      lastTriggeredAt: now,
      triggeredCount: (getRuleMetadata(rule).triggeredCount || 0) + 1,
    });

    // Execute actions on matching items

    // Execute actions
    for (const item of matchingItems) {
      try {
        // Execute the action

        let actionSucceeded = false;
        let result;

        switch (rule.action.type) {
          case 'stop_seeding':
            // Stop seeding the torrent
            result = await controlTorrent(item.id, 'stop_seeding');
            actionSucceeded = result.success;
            break;
          case 'archive':
            // Archive the download
            archiveDownload(item);
            result = await deleteItemHelper(item.id, apiKey);
            actionSucceeded = result.success;
            break;
          case 'delete':
            // Delete the download
            result = await deleteItemHelper(item.id, apiKey);
            actionSucceeded = result.success;
            break;
          case 'force_start':
            // Force start the download
            result = await controlQueuedItem(item.id, 'start');
            actionSucceeded = result.success;
            break;
        }

        if (actionSucceeded) {
          // Only increment execution count when action succeeds
          updateRuleMetadata(rule.id, {
            lastExecutedAt: now,
            executionCount: (getRuleMetadata(rule).executionCount || 0) + 1,
          });
        }
      } catch (error) {
        console.error('❌ Action execution failed:', {
          ruleName: rule.name,
          itemName: item.name,
          action: rule.action.type,
          error,
        });
      }
    }
  };

  // Update items ref when items change
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Main initialization
  useEffect(() => {
    // Skip initialization if not for torrents
    if (activeType !== 'torrents') {
      return;
    }

    if (initializationRef.current) return;
    initializationRef.current = true;

    // Initialize automation rules

    const savedRules = localStorage.getItem('torboxAutomationRules');
    if (savedRules) {
      rulesRef.current = JSON.parse(savedRules);
      // Rules loaded from storage
    }

    function setupRuleInterval(rule) {
      if (!rule.enabled) {
        // Skip disabled rules
        return;
      }

      const now = Date.now();
      const metadata = getRuleMetadata(rule, now);
      let initialDelay = rule.trigger.value * 1000 * 60;
      const referenceTime = metadata.lastTriggeredAt || metadata.lastEnabledAt;

      if (referenceTime) {
        const timeSinceRef = now - referenceTime;
        const remainingTime = initialDelay - timeSinceRef;
        initialDelay = Math.max(0, remainingTime);

        // Calculate initial delay for rule execution
      }

      // Set up rule timer

      // Clear any existing interval
      if (intervalsRef.current[rule.id]) {
        clearInterval(intervalsRef.current[rule.id]);
      }

      // Set up new interval
      setTimeout(() => {
        // Execute rule initially
        executeRule(rule, itemsRef.current);

        intervalsRef.current[rule.id] = setInterval(
          () => {
            // Execute rule on interval
            executeRule(rule, itemsRef.current);
          },
          rule.trigger.value * 1000 * 60,
        );
      }, initialDelay);
    }

    // Set up intervals for all rules
    rulesRef.current.forEach(setupRuleInterval);

    // Listen for rule changes in storage
    const handleStorageChange = (e) => {
      if (e.key === 'torboxAutomationRules') {
        // Rules updated, reload intervals
        const newRules = JSON.parse(e.newValue || '[]');

        // Find rules that were deleted or disabled
        rulesRef.current.forEach((oldRule) => {
          const newRule = newRules.find((r) => r.id === oldRule.id);
          if (!newRule || !newRule.enabled) {
            if (intervalsRef.current[oldRule.id]) {
              clearInterval(intervalsRef.current[oldRule.id]);
              delete intervalsRef.current[oldRule.id];
            }
          }
        });

        rulesRef.current = newRules;
        rulesRef.current.forEach(setupRuleInterval);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      // Clean up rule intervals
      window.removeEventListener('storage', handleStorageChange);
      Object.values(intervalsRef.current).forEach((interval) =>
        clearInterval(interval),
      );
    };
  });
}
