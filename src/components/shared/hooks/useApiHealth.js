import { useEffect } from 'react';
import { useHealthStore } from '@/store/healthStore';

export function useApiHealth(apiKey) {
  const {
    localHealth,
    apiHealth,
    lastCheck,
    error,
    performHealthCheck,
    setApiKey,
  } = useHealthStore();

  // Update API key in store when it changes (this will reset apiHealth if changed)
  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
    }
  }, [apiKey, setApiKey]);

  // Manual health check function
  const refreshHealth = () => {
    if (apiKey) {
      performHealthCheck(apiKey);
    }
  };

  // Determine overall system status
  const getOverallStatus = () => {
    if (localHealth === 'unhealthy') return 'unhealthy';
    if (apiHealth === 'unhealthy') return 'api-unhealthy';
    if (apiHealth === 'no-key') return 'no-api-key';
    if (localHealth === 'healthy' && apiHealth === 'healthy') return 'healthy';
    return 'unknown';
  };

  return {
    localHealth,
    apiHealth,
    overallStatus: getOverallStatus(),
    lastCheck,
    error,
    refreshHealth,
    isLoading: localHealth === 'unknown' || apiHealth === 'unknown',
  };
}
