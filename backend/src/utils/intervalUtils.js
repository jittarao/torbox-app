/**
 * Interval utilities for development/testing
 * Allows reducing intervals in development environment for faster testing
 */

/**
 * Get the interval multiplier for development mode
 * In development, can use DEV_INTERVAL_MULTIPLIER to speed up intervals
 * @returns {number} - Multiplier (1.0 = normal, 0.1 = 10x faster, 0.01 = 100x faster)
 */
export function getIntervalMultiplier() {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    return 1.0; // No change in production
  }
  
  // In development, check for DEV_INTERVAL_MULTIPLIER env var
  // Default to 0.1 (10x faster) if not specified
  const multiplier = parseFloat(process.env.DEV_INTERVAL_MULTIPLIER || '0.1');
  
  // Ensure multiplier is between 0.001 and 1.0 for safety
  return Math.max(0.001, Math.min(1.0, multiplier));
}

/**
 * Apply interval multiplier to a time value in minutes
 * @param {number} minutes - Original interval in minutes
 * @returns {number} - Adjusted interval in minutes
 */
export function applyIntervalMultiplier(minutes) {
  const multiplier = getIntervalMultiplier();
  const adjusted = minutes * multiplier;
  
  // Log in development if multiplier is active
  if (process.env.NODE_ENV === 'development' && multiplier < 1.0) {
    // Only log once per process to avoid spam
    if (!global._intervalMultiplierLogged) {
      console.log(`[DEV] Interval multiplier active: ${multiplier}x (${minutes}min -> ${adjusted.toFixed(3)}min)`);
      global._intervalMultiplierLogged = true;
    }
  }
  
  return adjusted;
}

/**
 * Apply interval multiplier to milliseconds
 * @param {number} ms - Original interval in milliseconds
 * @returns {number} - Adjusted interval in milliseconds
 */
export function applyIntervalMultiplierMs(ms) {
  const multiplier = getIntervalMultiplier();
  return ms * multiplier;
}
