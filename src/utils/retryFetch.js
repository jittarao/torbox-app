// Remove all TypeScript annotations and keep only the implementation
'use client';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_DELAY_MS = 2000;

// Helper function to get user-friendly error messages
const getErrorMessage = (error, status, url) => {
  // Network errors
  if (error.message === 'NetworkError when attempting to fetch resource.') {
    return 'Network connection failed. Please check your internet connection and try again.';
  }
  
  if (error.message.includes('Failed to fetch')) {
    return 'Unable to connect to TorBox servers. Please check your internet connection and try again.';
  }

  // HTTP status code errors
  if (status) {
    switch (status) {
      case 502:
        return 'TorBox servers are temporarily unavailable (502 Bad Gateway). Please try again in a few minutes.';
      case 503:
        return 'TorBox servers are temporarily overloaded (503 Service Unavailable). Please try again in a few minutes.';
      case 504:
        return 'TorBox servers are taking too long to respond (504 Gateway Timeout). Please try again in a few minutes.';
      case 429:
        return 'Too many requests to TorBox servers. Please wait a moment and try again.';
      case 401:
        return 'Authentication failed. Please check your API key.';
      case 403:
        return 'Access denied. Please check your API key and account status.';
      case 404:
        return 'The requested resource was not found on TorBox servers.';
      case 500:
        return 'TorBox servers encountered an internal error. Please try again later.';
      default:
        return `TorBox servers returned an error (${status}). Please try again later.`;
    }
  }

  // Generic error fallback
  return error.message || 'An unexpected error occurred. Please try again.';
};

export async function retryFetch(url, options = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    delayMs = DEFAULT_DELAY_MS,
    permanent = [],
    method = 'GET',
    headers = {},
    body,
  } = options;

  let retries = 0;
  let lastError = null;
  let lastStatus = null;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        ...(body && {
          body:
            body instanceof FormData
              ? body
              : typeof body === 'string'
                ? body
                : JSON.stringify(body),
        }),
      });

      lastStatus = response.status;

      if (!response.ok) {
        // For 502, 503, 504 errors, we want to retry
        if ([502, 503, 504, 429].includes(response.status)) {
          lastError = new Error(`HTTP error! status: ${response.status}`);
          retries++;
          if (retries < maxRetries) {
            // Exponential backoff for server errors
            const backoffDelay = delayMs * Math.pow(2, retries - 1);
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            continue;
          }
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const data = await response.json();

      // Check for permanent failures that shouldn't be retried
      if (!data.success && permanent.some((check) => check(data))) {
        return {
          success: false,
          error: data.error || data.detail || 'Permanent failure',
          userMessage: data.detail || 'The request could not be completed.',
        };
      }

      // Special handling for DATABASE_ERROR - allow retries since it might be temporary
      if (!data.success && data.error === 'DATABASE_ERROR') {
        retries++;
        if (retries < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        } else {
          return {
            success: false,
            error: data.error,
            detail: data.detail,
            userMessage: 'TorBox database is temporarily unavailable. Please try again in a few minutes.',
          };
        }
      }

      if (data.success) {
        return { success: true, data };
      }

      retries++;
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      lastError = error;
      retries++;
      if (retries === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          userMessage: getErrorMessage(error, lastStatus, url),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { 
    success: false, 
    error: `Failed after ${maxRetries} retries`,
    userMessage: getErrorMessage(lastError, lastStatus, url),
  };
}

// Helper to create retry options with defaults
export function createRetryOptions(overrides = {}) {
  return {
    maxRetries: DEFAULT_MAX_RETRIES,
    delayMs: DEFAULT_DELAY_MS,
    ...overrides,
  };
}
