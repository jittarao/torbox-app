import { useAppStore } from '@/store/appStore';

/**
 * Ensures the user database exists for a given API key
 * This should be called when an API key is loaded or set
 * @param {string} apiKey - The API key to ensure DB for
 * @returns {Promise<{success: boolean, wasCreated?: boolean, error?: string}>}
 */
export async function ensureUserDb(apiKey) {
  if (!apiKey || apiKey.length < 20) {
    return { success: false, error: 'Invalid API key' };
  }

  const { isDbEnsured, isEnsuringDb, setEnsuringDb, markDbEnsured } = useAppStore.getState();

  // If already ensured, return success immediately
  if (isDbEnsured(apiKey)) {
    return { success: true, wasCreated: false, dbExists: true };
  }

  // If currently ensuring, return early to prevent duplicate calls
  if (isEnsuringDb(apiKey)) {
    return { success: true, wasCreated: false, dbExists: true };
  }

  // Mark as ensuring
  setEnsuringDb(apiKey, true);

  try {
    const response = await fetch('/api/backend/api-key/ensure-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Mark as ensured
      markDbEnsured(apiKey);
      setEnsuringDb(apiKey, false);
      return { 
        success: true, 
        wasCreated: data.wasCreated || false,
        dbExists: data.dbExists || false
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      setEnsuringDb(apiKey, false);
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    console.error('Error ensuring user database:', error);
    setEnsuringDb(apiKey, false);
    return { 
      success: false, 
      error: error.message || 'Failed to ensure user database' 
    };
  }
}

