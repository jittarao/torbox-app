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
 * Hook for hybrid storage that works with both local and backend storage
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value
 * @returns {Array} [value, setValue, loading, error]
 */
export const useHybridStorage = (key, defaultValue) => {
  const { mode, isLoading: backendLoading } = useBackendMode();
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load value from storage
  useEffect(() => {
    const loadValue = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mode === 'backend') {
          // Try backend first
          const response = await fetch(`/api/storage/${key}`);
          if (response.ok) {
            const data = await response.json();
            setValue(data.value || defaultValue);
          } else {
            // Fallback to local storage
            const localValue = localStorage.getItem(key);
            setValue(localValue ? JSON.parse(localValue) : defaultValue);
          }
        } else {
          // Use local storage
          const localValue = localStorage.getItem(key);
          setValue(localValue ? JSON.parse(localValue) : defaultValue);
        }
      } catch (err) {
        console.error(`Error loading ${key}:`, err);
        setError(err.message);
        
        // Fallback to local storage
        try {
          const localValue = localStorage.getItem(key);
          setValue(localValue ? JSON.parse(localValue) : defaultValue);
        } catch (localErr) {
          console.error(`Local storage fallback failed for ${key}:`, localErr);
          setValue(defaultValue);
        }
      } finally {
        setLoading(false);
      }
    };

    if (!backendLoading) {
      loadValue();
    }
  }, [key, mode, backendLoading]);

  // Save value to storage
  const saveValue = async (newValue) => {
    try {
      setError(null);

      if (mode === 'backend') {
        // Save to backend
        const response = await fetch(`/api/storage/${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value: newValue }),
        });

        if (!response.ok) {
          throw new Error(`Backend save failed: ${response.status}`);
        }
      }

      // Always save to local storage as backup
      localStorage.setItem(key, JSON.stringify(newValue));
      setValue(newValue);
    } catch (err) {
      console.error(`Error saving ${key}:`, err);
      setError(err.message);
      
      // Fallback to local storage only
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
        setValue(newValue);
      } catch (localErr) {
        console.error(`Local storage fallback failed for ${key}:`, localErr);
        setError(localErr.message);
      }
    }
  };

  return [value, saveValue, loading || backendLoading, error];
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

  useEffect(() => {
    const loadRules = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mode === 'backend') {
          // Try backend first
          const response = await fetch('/api/automation/rules');
          if (response.ok) {
            const data = await response.json();
            setRules(data.rules || []);
          } else {
            // Fallback to local storage
            const localRules = localStorage.getItem('torboxAutomationRules');
            setRules(localRules ? JSON.parse(localRules) : []);
          }
        } else {
          // Use local storage
          const localRules = localStorage.getItem('torboxAutomationRules');
          setRules(localRules ? JSON.parse(localRules) : []);
        }
      } catch (err) {
        console.error('Error loading automation rules:', err);
        setError(err.message);
        
        // Fallback to local storage
        try {
          const localRules = localStorage.getItem('torboxAutomationRules');
          setRules(localRules ? JSON.parse(localRules) : []);
        } catch (localErr) {
          console.error('Local storage fallback failed:', localErr);
          setRules([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, [mode]);

  const saveRules = async (newRules) => {
    try {
      setError(null);

      if (mode === 'backend') {
        // Save to backend
        const response = await fetch('/api/automation/rules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rules: newRules }),
        });

        if (!response.ok) {
          throw new Error(`Backend save failed: ${response.status}`);
        }
      }

      // Always save to local storage as backup
      localStorage.setItem('torboxAutomationRules', JSON.stringify(newRules));
      setRules(newRules);
    } catch (err) {
      console.error('Error saving automation rules:', err);
      setError(err.message);
      
      // Fallback to local storage only
      try {
        localStorage.setItem('torboxAutomationRules', JSON.stringify(newRules));
        setRules(newRules);
      } catch (localErr) {
        console.error('Local storage fallback failed:', localErr);
        setError(localErr.message);
      }
    }
  };

  return [rules, saveRules, loading, error];
};

/**
 * Hook for download history with backend support
 * @returns {Array} [history, setHistory, loading, error]
 */
export const useDownloadHistoryStorage = () => {
  const { mode } = useBackendMode();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        if (mode === 'backend') {
          // Try backend first
          const response = await fetch('/api/downloads/history');
          if (response.ok) {
            const data = await response.json();
            setHistory(data.history || []);
          } else {
            // Fallback to local storage
            const localHistory = localStorage.getItem('torboxDownloadHistory');
            setHistory(localHistory ? JSON.parse(localHistory) : []);
          }
        } else {
          // Use local storage
          const localHistory = localStorage.getItem('torboxDownloadHistory');
          setHistory(localHistory ? JSON.parse(localHistory) : []);
        }
      } catch (err) {
        console.error('Error loading download history:', err);
        setError(err.message);
        
        // Fallback to local storage
        try {
          const localHistory = localStorage.getItem('torboxDownloadHistory');
          setHistory(localHistory ? JSON.parse(localHistory) : []);
        } catch (localErr) {
          console.error('Local storage fallback failed:', localErr);
          setHistory([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [mode]);

  const saveHistory = async (newHistory) => {
    try {
      setError(null);

      if (mode === 'backend') {
        // Save to backend
        const response = await fetch('/api/downloads/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ history: newHistory }),
        });

        if (!response.ok) {
          throw new Error(`Backend save failed: ${response.status}`);
        }
      }

      // Always save to local storage as backup
      localStorage.setItem('torboxDownloadHistory', JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (err) {
      console.error('Error saving download history:', err);
      setError(err.message);
      
      // Fallback to local storage only
      try {
        localStorage.setItem('torboxDownloadHistory', JSON.stringify(newHistory));
        setHistory(newHistory);
      } catch (localErr) {
        console.error('Local storage fallback failed:', localErr);
        setError(localErr.message);
      }
    }
  };

  return [history, saveHistory, loading, error];
};

export default {
  useBackendMode,
  useHybridStorage,
  useAutomationRulesStorage,
  useDownloadHistoryStorage,
};
