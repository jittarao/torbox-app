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
      return { 
        success: true, 
        wasCreated: data.wasCreated || false,
        dbExists: data.dbExists || false
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    console.error('Error ensuring user database:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to ensure user database' 
    };
  }
}

