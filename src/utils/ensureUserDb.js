import { useAppStore } from '@/store/appStore';
import { readJsonFromResponse } from '@/utils/fetchResponse';

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

  if (useAppStore.getState().isDbEnsured(apiKey)) {
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
  const app = useAppStore.getState();
  if (app.isDbEnsured(apiKey)) {
    return { success: true, wasCreated: false, dbExists: true };
  }

  app.setEnsuringDb(apiKey, true);

  try {
    const response = await fetch('/api/backend/api-key/ensure-db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    const { ok: responseOk, data } = await readJsonFromResponse(response);

    if (responseOk) {
      useAppStore.getState().markDbEnsured(apiKey);
      return {
        success: true,
        wasCreated: data.wasCreated || false,
        dbExists: data.dbExists || false,
      };
    }

    return {
      success: false,
      error: data.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    console.error('Error ensuring user database:', error);
    return {
      success: false,
      error: error.message || 'Failed to ensure user database',
    };
  } finally {
    useAppStore.getState().setEnsuringDb(apiKey, false);
  }
}
