import { useAppStore } from '@/store/appStore';

/** In-flight ensure-db requests per API key (concurrent callers share one promise). */
const ensureDbPromises = new Map();

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

  const { isDbEnsured } = useAppStore.getState();

  if (isDbEnsured(apiKey)) {
    return { success: true, wasCreated: false, dbExists: true };
  }

  const inFlight = ensureDbPromises.get(apiKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = runEnsureUserDb(apiKey);
  ensureDbPromises.set(apiKey, promise);

  try {
    return await promise;
  } finally {
    if (ensureDbPromises.get(apiKey) === promise) {
      ensureDbPromises.delete(apiKey);
    }
  }
}

async function runEnsureUserDb(apiKey) {
  const { isDbEnsured, setEnsuringDb, markDbEnsured } = useAppStore.getState();

  if (isDbEnsured(apiKey)) {
    return { success: true, wasCreated: false, dbExists: true };
  }

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
      markDbEnsured(apiKey);
      return {
        success: true,
        wasCreated: data.wasCreated || false,
        dbExists: data.dbExists || false,
      };
    }

    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('Error ensuring user database:', error);
    return {
      success: false,
      error: error.message || 'Failed to ensure user database',
    };
  } finally {
    setEnsuringDb(apiKey, false);
  }
}
