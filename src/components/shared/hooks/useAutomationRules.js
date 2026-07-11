import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAutomationRulesStore } from '@/store/automationRulesStore';
import { useBackendMode } from '@/hooks/useBackendMode';

/**
 * Hook for using automation rules with automatic loading
 */
export function useAutomationRules(apiKey) {
  const { rules, loading, error, loadRules, saveRules, setApiKey } = useAutomationRulesStore(
    useShallow((s) => ({
      rules: s.rules,
      loading: s.loading,
      error: s.error,
      loadRules: s.loadRules,
      saveRules: s.saveRules,
      setApiKey: s.setApiKey,
    }))
  );

  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();

  const loadAttemptedRef = useRef(false);
  const lastApiKeyRef = useRef(null);
  const lastBackendModeRef = useRef(null);

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  useEffect(() => {
    if (backendIsLoading) {
      return;
    }

    if (lastApiKeyRef.current !== apiKey) {
      loadAttemptedRef.current = false;
      lastApiKeyRef.current = apiKey;
    }

    if (lastBackendModeRef.current !== 'backend' && backendMode === 'backend') {
      loadAttemptedRef.current = false;
    }
    lastBackendModeRef.current = backendMode;

    // Always sync from backend when it becomes available — not only when the store is empty.
    // Otherwise a toggle while the backend was down can leave local "disabled" state while
    // SQLite still has enabled=1, and we would never refetch to surface the mismatch.
    if (apiKey && !loading && backendMode === 'backend' && !loadAttemptedRef.current) {
      loadAttemptedRef.current = true;
      loadRules(apiKey);
    }
  }, [apiKey, loading, backendMode, backendIsLoading, loadRules]);

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
