// Remove all TypeScript annotations and keep only the implementation
'use client';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_DELAY_MS = 2000;

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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check for permanent failures that shouldn't be retried
      if (!data.success && permanent.some((check) => check(data))) {
        return {
          success: false,
          error: data.error || data.detail || 'Permanent failure',
        };
      }

      if (data.success) {
        return { success: true, data };
      }

      retries++;
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { success: false, error: `Failed after ${maxRetries} retries` };
}

// Helper to create retry options with defaults
export function createRetryOptions(overrides = {}) {
  return {
    maxRetries: DEFAULT_MAX_RETRIES,
    delayMs: DEFAULT_DELAY_MS,
    ...overrides,
  };
}
