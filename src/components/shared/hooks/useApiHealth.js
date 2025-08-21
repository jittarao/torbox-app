import { useState, useEffect, useRef } from 'react';

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const API_HEALTH_TIMEOUT = 5000; // 5 seconds

export function useApiHealth(apiKey) {
  const [localHealth, setLocalHealth] = useState('unknown');
  const [apiHealth, setApiHealth] = useState('unknown');
  const [lastCheck, setLastCheck] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Check local application health
  const checkLocalHealth = async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(API_HEALTH_TIMEOUT),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLocalHealth(data.status === 'healthy' ? 'healthy' : 'unhealthy');
        setError(null);
      } else {
        setLocalHealth('unhealthy');
        setError('Local health check failed');
      }
    } catch (err) {
      setLocalHealth('unhealthy');
      setError(err.message);
    }
  };

  // Check TorBox API health (only if we have an API key)
  const checkApiHealth = async () => {
    if (!apiKey) {
      setApiHealth('no-key');
      return;
    }

    try {
      const response = await fetch('/api/health/torbox', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(API_HEALTH_TIMEOUT),
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiHealth(data.status);
        setError(data.status === 'healthy' ? null : data.message);
      } else {
        setApiHealth('unhealthy');
        setError('Failed to check TorBox API health');
      }
    } catch (err) {
      setApiHealth('unhealthy');
      setError(err.message);
    }
  };

  // Combined health check
  const performHealthCheck = async () => {
    setLastCheck(new Date());
    
    // Check both local and API health in parallel
    await Promise.all([
      checkLocalHealth(),
      checkApiHealth()
    ]);
  };

  // Start periodic health checks
  useEffect(() => {
    // Perform initial health check
    performHealthCheck();

    // Set up periodic health checks
    intervalRef.current = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [apiKey]);

  // Manual health check function
  const refreshHealth = () => {
    performHealthCheck();
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
    isLoading: localHealth === 'unknown' || apiHealth === 'unknown'
  };
}
