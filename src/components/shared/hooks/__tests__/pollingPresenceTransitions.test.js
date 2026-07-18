import { describe, expect, it } from 'bun:test';
import { pollScheduleFirstDelay } from '../pollTimerSchedule';
import { POLLING_CONFIG } from '../pollingConfig';
import {
  shouldReEngageOnMediaUnpause,
  shouldRescheduleOnQueueChange,
} from '../userPresenceTransitions';
import { resolvePollInterval } from '../pollInterval';

describe('shouldReEngageOnMediaUnpause', () => {
  it('re-engages when media closes while the tab is present and active', () => {
    expect(
      shouldReEngageOnMediaUnpause({
        wasPaused: true,
        pollingPaused: false,
        isEffectivelyPresent: true,
        isUserIdle: false,
      })
    ).toBe(true);
  });

  it('does not re-engage when media is still playing', () => {
    expect(
      shouldReEngageOnMediaUnpause({
        wasPaused: true,
        pollingPaused: true,
        isEffectivelyPresent: true,
        isUserIdle: false,
      })
    ).toBe(false);
  });

  it('does not re-engage when the tab is hidden or idle', () => {
    expect(
      shouldReEngageOnMediaUnpause({
        wasPaused: true,
        pollingPaused: false,
        isEffectivelyPresent: false,
        isUserIdle: false,
      })
    ).toBe(false);

    expect(
      shouldReEngageOnMediaUnpause({
        wasPaused: true,
        pollingPaused: false,
        isEffectivelyPresent: true,
        isUserIdle: true,
      })
    ).toBe(false);
  });
});

describe('shouldRescheduleOnQueueChange', () => {
  it('is true only when queued state changes', () => {
    expect(shouldRescheduleOnQueueChange(false, true)).toBe(true);
    expect(shouldRescheduleOnQueueChange(true, false)).toBe(true);
    expect(shouldRescheduleOnQueueChange(true, true)).toBe(false);
    expect(shouldRescheduleOnQueueChange(false, false)).toBe(false);
  });
});

describe('pollScheduleFirstDelay', () => {
  it('uses active interval for active mode', () => {
    expect(
      pollScheduleFirstDelay({
        mode: 'active',
        intervalMs: POLLING_CONFIG.backgroundIntervalMs,
      })
    ).toBe(POLLING_CONFIG.activeIntervalMs);
  });

  it('uses poll state interval for non-active modes', () => {
    expect(
      pollScheduleFirstDelay({
        mode: 'background',
        intervalMs: POLLING_CONFIG.backgroundIntervalMs,
      })
    ).toBe(POLLING_CONFIG.backgroundIntervalMs);

    expect(
      pollScheduleFirstDelay({
        mode: 'autoStartQueued',
        intervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
      })
    ).toBe(POLLING_CONFIG.autoStartQueuedIntervalMs);
  });
});

describe('background polling without worker gate', () => {
  it('keeps full-view background polling when disengaged without queued torrents', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: false,
    });

    expect(result).toEqual({
      intervalMs: POLLING_CONFIG.backgroundIntervalMs,
      mode: 'background',
      shouldPoll: true,
    });
  });

  it('uses 60s torrent-only tier when disengaged with queued torrents', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: true,
    });

    expect(result.mode).toBe('autoStartQueued');
    expect(result.shouldPoll).toBe(true);
  });
});
