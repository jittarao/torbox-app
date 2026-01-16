import { useEffect, useRef } from 'react';
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

  // Track if we've attempted to load rules to prevent infinite loops
  const loadAttemptedRef = useRef(false);
  const lastApiKeyRef = useRef(null);
  const lastBackendModeRef = useRef(null);

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

    // Reset load attempt flag if API key changed
    if (lastApiKeyRef.current !== apiKey) {
      loadAttemptedRef.current = false;
      lastApiKeyRef.current = apiKey;
    }

    // Reset load attempt flag if backend mode changed from unavailable to available
    if (lastBackendModeRef.current !== 'backend' && backendMode === 'backend') {
      loadAttemptedRef.current = false;
    }
    lastBackendModeRef.current = backendMode;

    // Only load rules if we have an API key, no rules loaded yet, not currently loading, backend is available, and we haven't already attempted to load
    if (
      apiKey &&
      rules.length === 0 &&
      !loading &&
      backendMode === 'backend' &&
      !loadAttemptedRef.current
    ) {
      loadAttemptedRef.current = true;
      loadRules(apiKey);
    }
  }, [apiKey, rules.length, loading, backendMode, backendIsLoading]);

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
