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
    // console.log('📝 Updating rule metadata:', { ruleId, updates });
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
    // console.log('🔄 Checking rule:', { ruleName: rule.name, ruleId: rule.id });

    if (!rule.enabled) {
      // console.log('⏭️ Rule skipped - disabled:', {
      //   ruleName: rule.name,
      //   ruleId: rule.id,
      // });
      return;
    }

    const now = Date.now();

    // Find items that meet the condition
    const matchingItems = items.filter((item) => {
      let conditionValue = 0;
      switch (rule.condition.type) {
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
      }

      const conditionMet = compareValues(
        conditionValue,
        rule.condition.operator,
        rule.condition.value,
      );

      // console.log('🎯 Condition check:', {
      //   ruleName: rule.name,
      //   itemName: item.name,
      //   type: rule.condition.type,
      //   value: conditionValue,
      //   threshold: rule.condition.value,
      //   met: conditionMet,
      // });

      return conditionMet;
    });

    if (matchingItems.length === 0) {
      // console.log('⏭️ No items match conditions for rule:', rule.name);
      return;
    }

    // Update trigger metadata once per execution, not per item
    updateRuleMetadata(rule.id, {
      lastTriggeredAt: now,
      triggeredCount: (getRuleMetadata(rule).triggeredCount || 0) + 1,
    });

    // console.log('✨ Rule triggered for items:', {
    //   ruleName: rule.name,
    //   items: matchingItems.map((i) => i.name),
    // });

    // Execute actions
    for (const item of matchingItems) {
      try {
        // console.log('🎬 Executing action:', {
        //   ruleName: rule.name,
        //   itemName: item.name,
        //   action: rule.action.type,
        // });

        let actionSucceeded = false;
        let result;

        switch (rule.action.type) {
          case 'stop_seeding':
            // console.log('🛑 Stop seeding:', {
            //   itemName: item.name,
            //   itemId: item.id,
            // });
            result = await controlTorrent(item.id, 'stop_seeding');
            actionSucceeded = result.success;
            break;
          case 'archive':
            // console.log('📦 Archive:', {
            //   itemName: item.name,
            //   itemId: item.id,
            // });
            archiveDownload(item);
            result = await deleteItemHelper(item.id, apiKey);
            actionSucceeded = result.success;
            break;
          case 'delete':
            // console.log('🗑️ Delete:', { itemName: item.name, itemId: item.id });
            result = await deleteItemHelper(item.id, apiKey);
            actionSucceeded = result.success;
            break;
          case 'force_start':
            // console.log('▶️ Force start:', {
            //   itemName: item.name,
            //   itemId: item.id,
            // });
            result = await controlQueuedItem(item.id, 'force_start');
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

    // // console.log('🔄 Initial setup of automation rules');

    const savedRules = localStorage.getItem('torboxAutomationRules');
    if (savedRules) {
      rulesRef.current = JSON.parse(savedRules);
      // console.log('📥 Loaded rules from storage:', rulesRef.current);
    }

    function setupRuleInterval(rule) {
      if (!rule.enabled) {
        // console.log('⏭️ Skipping disabled rule:', rule.name);
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

        // console.log('⏰ Calculated initial delay:', {
        //   ruleName: rule.name,
        //   referenceTime: new Date(referenceTime).toISOString(),
        //   initialDelay: Math.round(initialDelay / 1000) + 's',
        // });
      }

      // console.log('⏱️ Setting up rule timer:', {
      //   ruleName: rule.name,
      //   interval: rule.trigger.value + 'm',
      //   initialDelay: Math.round(initialDelay / 1000) + 's',
      // });

      // Clear any existing interval
      if (intervalsRef.current[rule.id]) {
        clearInterval(intervalsRef.current[rule.id]);
      }

      // Set up new interval
      setTimeout(() => {
        // console.log('🏃 Initial rule execution:', rule.name);
        executeRule(rule, itemsRef.current);

        intervalsRef.current[rule.id] = setInterval(
          () => {
            // console.log('⏰ Interval triggered for rule:', rule.name);
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
        // console.log('📝 Rules updated in storage, reloading intervals');
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
      // console.log('♻️ Cleaning up rule intervals');
      window.removeEventListener('storage', handleStorageChange);
      Object.values(intervalsRef.current).forEach((interval) =>
        clearInterval(interval),
      );
    };
  });
}
