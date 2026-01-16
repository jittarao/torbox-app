import { useState, useEffect } from 'react';

/**
 * Hook to detect if backend is available and determine storage mode
 * @returns {Object} { mode: 'local' | 'backend', isLoading: boolean, error: string | null }
 */
export const useBackendMode = () => {
  const [mode, setMode] = useState('local');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkBackend = async () => {
      // Check if we already know the backend status
      const cachedMode = sessionStorage.getItem('torboxBackendMode');
      if (cachedMode) {
        setMode(cachedMode);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/backend/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const detectedMode = data.available ? 'backend' : 'local';
          setMode(detectedMode);
          sessionStorage.setItem('torboxBackendMode', detectedMode);
        } else {
          setMode('local');
          sessionStorage.setItem('torboxBackendMode', 'local');
        }
      } catch (err) {
        // Only log once to avoid console spam
        if (!window.backendModeLogged) {
          console.log('Backend not available, using local storage mode');
          window.backendModeLogged = true;
        }
        setMode('local');
        setError(err.message);
        sessionStorage.setItem('torboxBackendMode', 'local');
      } finally {
        setIsLoading(false);
      }
    };

    checkBackend();
  }, []);

  return { mode, isLoading, error };
};

/**
 * Hook specifically for automation rules with backend support
 * @returns {Array} [rules, setRules, loading, error]
 */
export const useAutomationRulesStorage = () => {
  const { mode } = useBackendMode();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiKey = localStorage.getItem('torboxApiKey');

  useEffect(() => {
    const loadRules = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mode === 'backend') {
          // Load from backend only
          const headers = {
            'Content-Type': 'application/json',
          };

          if (apiKey) {
            headers['x-api-key'] = apiKey;
          }

          const response = await fetch('/api/automation/rules', {
            headers,
          });

          if (response.ok) {
            const data = await response.json();
            setRules(data.rules || []);
          } else {
            // Backend unavailable, return empty array
            setRules([]);
          }
        } else {
          // No backend mode, return empty array
          setRules([]);
        }
      } catch (err) {
        console.error('Error loading automation rules:', err);
        setError(err.message);
        setRules([]);
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [mode, apiKey]);

  const saveRules = async (newRules) => {
    try {
      setError(null);

      if (mode === 'backend') {
        // Save to backend only
        const headers = {
          'Content-Type': 'application/json',
        };

        if (apiKey) {
          headers['x-api-key'] = apiKey;
        }

        const response = await fetch('/api/automation/rules', {
          method: 'POST',
          headers,
          body: JSON.stringify({ rules: newRules }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Backend save failed: ${response.status}`);
        }

        // Update local state after successful backend save
        setRules(newRules);
      } else {
        // No backend mode, just update local state
        setRules(newRules);
      }
    } catch (err) {
      console.error('Error saving automation rules:', err);
      setError(err.message);
      throw err; // Re-throw so caller can handle the error
    }
  };

  return [rules, saveRules, loading, error];
};

export default {
  useBackendMode,
  useAutomationRulesStorage,
};
