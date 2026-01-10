/**
 * Safely parse a fetch Response as JSON, handling non-JSON responses gracefully
 * @param {Response} response - The fetch Response object
 * @returns {Promise<Object>} - Parsed JSON object or error object if parsing fails
 */
export async function safeJsonParse(response) {
  try {
    const contentType = response.headers.get('content-type');
    
    // Check if response is actually JSON
    if (contentType && !contentType.includes('application/json')) {
      // Try to get text for error messages
      const text = await response.text();
      return {
        error: text || `HTTP ${response.status}`,
        detail: 'Response is not JSON',
        _rawResponse: text
      };
    }
    
    // Try to parse as JSON
    const text = await response.text();
    if (!text) {
      return {
        error: `HTTP ${response.status}`,
        detail: 'Empty response body'
      };
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      // If JSON parsing fails, return error object with the raw text
      return {
        error: text || `HTTP ${response.status}`,
        detail: 'Invalid JSON response',
        _rawResponse: text
      };
    }
  } catch (error) {
    return {
      error: `HTTP ${response.status}`,
      detail: error.message || 'Failed to parse response'
    };
  }
}
