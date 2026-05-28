import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useHealthStore } from '@/store/healthStore';

function isCheckPending(check) {
  return check.status === 'unknown';
}

export function useApiHealth(apiKey) {
  const {
    platformHealth,
    connectionHealth,
    backendHealth,
    lastCheck,
    performHealthCheck,
    setApiKey,
    checkingHealth,
    platformHistory,
    loadHistory,
  } = useHealthStore(
    useShallow((s) => ({
      platformHealth: s.platformHealth,
      connectionHealth: s.connectionHealth,
      backendHealth: s.backendHealth,
      lastCheck: s.lastCheck,
      performHealthCheck: s.performHealthCheck,
      setApiKey: s.setApiKey,
      checkingHealth: s.checkingHealth,
      platformHistory: s.platformHistory,
      loadHistory: s.loadHistory,
    }))
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  const refreshHealth = useCallback(() => {
    performHealthCheck(apiKey, { force: true });
  }, [apiKey, performHealthCheck]);

  const getOverallStatus = () => {
    if (connectionHealth.status === 'invalid-key') {
      return 'invalid-key';
    }
    if (connectionHealth.status === 'unhealthy') {
      return 'api-unhealthy';
    }
    if (connectionHealth.status === 'no-key') {
      return 'no-api-key';
    }
    if (platformHealth.status === 'unhealthy') {
      return 'platform-unhealthy';
    }
    if (backendHealth.status === 'unhealthy') {
      return 'backend-unhealthy';
    }

    const platformOk = platformHealth.status === 'healthy';
    const connectionOk = apiKey
      ? connectionHealth.status === 'healthy'
      : connectionHealth.status === 'no-key';
    const backendOk = backendHealth.status === 'healthy' || backendHealth.status === 'unavailable';

    if (platformOk && connectionOk && backendOk) {
      return 'healthy';
    }

    return 'unknown';
  };

  const primaryError = connectionHealth.message || platformHealth.message || backendHealth.message;

  const isLoading =
    checkingHealth ||
    isCheckPending(platformHealth) ||
    (apiKey && isCheckPending(connectionHealth));

  return {
    platformHealth,
    connectionHealth,
    backendHealth,
    overallStatus: getOverallStatus(),
    lastCheck,
    error: primaryError,
    refreshHealth,
    isLoading,
    showBackend: backendHealth.status === 'healthy',
    platformHistory,
  };
}
