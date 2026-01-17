/**
 * Constants for automation engine
 */
export const INITIAL_POLL_INTERVAL_MINUTES = 5;
export const MIN_INTERVAL_MINUTES = 1;
export const DEFAULT_RETRY_MAX_RETRIES = 3;
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 100;

/**
 * Rate limiting for manual rule execution
 * Prevents abuse by limiting how frequently a rule can be manually executed
 */
export const MANUAL_EXECUTION_RATE_LIMIT_MS = parseInt(
  process.env.MANUAL_EXECUTION_RATE_LIMIT_MS || '300000',
  10
); // Default: 5 minutes (300000 ms)

/**
 * Terminal states that don't need to be tracked in shadow state
 * These states indicate torrents that are no longer active and won't change
 */
export const TERMINAL_STATES = Object.freeze(['completed', 'failed', 'inactive']);
