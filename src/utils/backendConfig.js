/**
 * Backend configuration utilities
 * 
 * Checks if the multi-user backend (PostgreSQL + Worker) is enabled
 */

/**
 * Check if multi-user backend is enabled
 * Backend is enabled if:
 * 1. MULTI_USER_BACKEND_ENABLED environment variable is set to 'true'
 * 2. OR DATABASE_URL is set (for backward compatibility)
 * 
 * @returns {boolean} True if backend is enabled
 */
export function isMultiUserBackendEnabled() {
  // Explicit check for the new environment variable
  if (process.env.MULTI_USER_BACKEND_ENABLED === 'true') {
    return true;
  }
  
  // If explicitly disabled, return false
  if (process.env.MULTI_USER_BACKEND_ENABLED === 'false') {
    return false;
  }
  
  // For backward compatibility, check DATABASE_URL
  // If DATABASE_URL is set, assume backend is enabled (unless explicitly disabled)
  if (process.env.DATABASE_URL) {
    return true;
  }
  
  // Default to disabled
  return false;
}

/**
 * Check if backend features should be available
 * This is a client-side check that can be used in React components
 * 
 * @returns {boolean} True if backend features should be shown
 */
export function shouldShowBackendFeatures() {
  // This will be determined by the backend status API
  // For now, return true if we're in a server context and backend is enabled
  if (typeof window === 'undefined') {
    return isMultiUserBackendEnabled();
  }
  
  // Client-side: check sessionStorage or make API call
  const cachedMode = sessionStorage.getItem('torboxBackendMode');
  return cachedMode === 'backend';
}

