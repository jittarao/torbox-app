/**
 * Constants for automation engine
 */
export const INITIAL_POLL_INTERVAL_MINUTES = 5;
export const MIN_INTERVAL_MINUTES = 1;
export const DEFAULT_RETRY_MAX_RETRIES = 3;
export const DEFAULT_RETRY_INITIAL_DELAY_MS = 100;

/**
 * Terminal states that don't need to be tracked in shadow state
 * These states indicate torrents that are no longer active and won't change
 */
export const TERMINAL_STATES = Object.freeze(['completed', 'failed', 'inactive']);
