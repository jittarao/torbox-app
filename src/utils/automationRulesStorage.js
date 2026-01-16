import { useState, useEffect } from 'react';
import { useBackendMode } from './backendCheck';

/**
 * Hook specifically for automation rules with backend support
 * @returns {Array} [rules, setRules, loading, error]
 */
export const useAutomationRulesStorage = () => {
  const { mode } = useBackendMode();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('torboxApiKey') : null;

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
