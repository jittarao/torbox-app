import { useEffect } from 'react';
import { useAutomationRulesStore } from '@/store/automationRulesStore';
import { useBackendModeStore } from '@/store/backendModeStore';

/**
 * Hook for using automation rules with automatic loading
 * Provides a convenient interface to the automation rules store
 * @param {string} apiKey - API key for authentication
 * @returns {Object} { rules, saveRules, loading, error, loadRules }
 */
export function useAutomationRules(apiKey) {
  const { rules, loading, error, loadRules, saveRules, setApiKey } = useAutomationRulesStore();

  // Subscribe to backend mode store to react to changes
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendModeStore();

  // Update API key in store when it changes
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Load rules when component mounts, apiKey changes, or backend mode becomes available
  useEffect(() => {
    // Wait for backend check to complete before deciding
    if (backendIsLoading) {
      return;
    }

    // Only load rules if we have an API key, no rules loaded yet, not currently loading, and backend is available
    if (apiKey && rules.length === 0 && !loading && backendMode === 'backend') {
      loadRules(apiKey);
    }
  }, [apiKey, rules.length, loading, backendMode, backendIsLoading, loadRules]);

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
