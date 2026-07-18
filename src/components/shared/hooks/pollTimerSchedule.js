import { POLLING_CONFIG } from './pollingConfig';

/**
 * @param {{ mode: string, intervalMs: number }} pollState
 */
export function pollScheduleFirstDelay(pollState) {
  return pollState.mode === 'active' ? POLLING_CONFIG.activeIntervalMs : pollState.intervalMs;
}
