import { useRef, useCallback } from 'react';
import { useUserPresence } from './useUserPresence';
import { usePollTimer } from './usePollTimer';

/**
 * Visibility- and idle-aware polling for download lists.
 * Composed from useUserPresence (visibility/idle) + usePollTimer (polling schedule).
 *
 * @param {Object} options
 * @param {string} options.type - Active view type: torrents | usenet | webdl | all
 * @param {boolean} options.pollingPaused - True when any pause reason is active
 * @param {(assetType: string) => void | Promise<void>} options.onPoll - Per-type fetch
 * @param {(assetType?: string) => boolean} options.isRateLimited
 * @param {() => void} [options.onPollSkipped] - Called when a tick is skipped due to rate limiting
 * @param {(schedule: import('./pollSchedule').PollSchedule) => void} [options.onScheduleUpdate] - Poll timer state for UI
 */
export function useDownloadListPolling({
  type,
  pollingPaused,
  onPoll,
  isRateLimited,
  onPollSkipped,
  onScheduleUpdate,
}) {
  const onReEngagedRef = useRef(() => {});
  const onDisengagedRef = useRef(() => {});
  const getUserPresenceRef = useRef(null);

  const userPresence = useUserPresence({
    pollingPaused,
    onReEngaged: useCallback((immediateRefresh) => {
      onReEngagedRef.current?.(immediateRefresh);
    }, []),
    onDisengaged: useCallback(() => {
      onDisengagedRef.current?.();
    }, []),
  });

  getUserPresenceRef.current = userPresence;

  usePollTimer({
    type,
    pollingPaused,
    onPoll,
    isRateLimited,
    onPollSkipped,
    onScheduleUpdate,
    getUserPresence: useCallback(() => getUserPresenceRef.current, []),
    onReEngagedRef,
    onDisengagedRef,
  });
}
