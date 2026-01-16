import { useEffect } from 'react';
import { useAutomationRulesStore } from '@/store/automationRulesStore';

/**
 * Hook for using automation rules with automatic loading
 * Provides a convenient interface to the automation rules store
 * @param {string} apiKey - API key for authentication
 * @returns {Object} { rules, saveRules, loading, error, loadRules }
 */
export function useAutomationRules(apiKey) {
  const { rules, loading, error, loadRules, saveRules, setApiKey } = useAutomationRulesStore();

  // Update API key in store when it changes
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Load rules when component mounts or apiKey changes
  useEffect(() => {
    if (apiKey && rules.length === 0 && !loading) {
      loadRules(apiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Wrapper for saveRules that includes apiKey
  const saveRulesWithKey = async (newRules) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    return await saveRules(apiKey, newRules);
  };

  return {
    rules,
    saveRules: saveRulesWithKey,
    loading,
    error,
    loadRules: () => loadRules(apiKey),
  };
}
