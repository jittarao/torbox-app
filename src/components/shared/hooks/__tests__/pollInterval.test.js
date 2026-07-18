import { describe, expect, it } from 'bun:test';
import {
  resolveAuxPollInterval,
  resolvePollInterval,
  shouldPollTorrentsOnly,
  wantsFastPoll,
} from '../pollInterval';
import { POLLING_CONFIG } from '../pollingConfig';

describe('resolvePollInterval', () => {
  it('uses 15s when tab is engaged regardless of auto-start', () => {
    expect(
      resolvePollInterval({
        pollingPaused: false,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
        hasQueuedTorrents: true,
      })
    ).toEqual({
      intervalMs: POLLING_CONFIG.activeIntervalMs,
      mode: 'active',
      shouldPoll: true,
    });

    expect(
      resolvePollInterval({
        pollingPaused: false,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: false,
        hasQueuedTorrents: false,
      }).intervalMs
    ).toBe(15_000);
  });

  it('uses 15s during engagement grace after tab hide', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: true,
      autoStartEnabled: true,
      hasQueuedTorrents: true,
    });
    expect(result.intervalMs).toBe(15_000);
    expect(result.mode).toBe('active');
  });

  it('uses 60s when disengaged, auto-start on, and queue has items', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: true,
    });
    expect(result.intervalMs).toBe(60_000);
    expect(result.mode).toBe('autoStartQueued');
    expect(result.shouldPoll).toBe(true);
  });

  it('uses 15min background when disengaged, auto-start on, and queue is empty', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: false,
    });
    expect(result.intervalMs).toBe(POLLING_CONFIG.backgroundIntervalMs);
    expect(result.mode).toBe('background');
    expect(result.shouldPoll).toBe(true);
  });

  it('uses 15min background when disengaged without auto-start', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: false,
      hasQueuedTorrents: true,
    });
    expect(result.shouldPoll).toBe(true);
    expect(result.mode).toBe('background');
    expect(result.intervalMs).toBe(POLLING_CONFIG.backgroundIntervalMs);
  });

  it('uses 15min background when media is playing without queued torrents', () => {
    const result = resolvePollInterval({
      pollingPaused: true,
      isDisengaged: false,
      isWithinEngagementGrace: false,
      autoStartEnabled: false,
      hasQueuedTorrents: false,
    });
    expect(result).toEqual({
      intervalMs: POLLING_CONFIG.backgroundIntervalMs,
      mode: 'background',
      shouldPoll: true,
    });
  });

  it('uses 60s auto-start queued when media is playing and queue has items', () => {
    const result = resolvePollInterval({
      pollingPaused: true,
      isDisengaged: false,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: true,
    });
    expect(result).toEqual({
      intervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
      mode: 'autoStartQueued',
      shouldPoll: true,
    });
  });

  it('uses 15min background when media is playing, auto-start on, and queue is empty', () => {
    const result = resolvePollInterval({
      pollingPaused: true,
      isDisengaged: false,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: false,
    });
    expect(result.mode).toBe('background');
    expect(result.intervalMs).toBe(POLLING_CONFIG.backgroundIntervalMs);
  });
});

describe('wantsFastPoll', () => {
  it('is false when media is playing even if the tab is engaged', () => {
    expect(
      wantsFastPoll({
        pollingPaused: true,
        isDisengaged: false,
        isWithinEngagementGrace: false,
      })
    ).toBe(false);
  });
});

describe('shouldPollTorrentsOnly', () => {
  it('is true only in background auto-start queued phase', () => {
    expect(
      shouldPollTorrentsOnly({
        pollingPaused: false,
        isDisengaged: true,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
        hasQueuedTorrents: true,
      })
    ).toBe(true);

    expect(
      shouldPollTorrentsOnly({
        pollingPaused: false,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
        hasQueuedTorrents: true,
      })
    ).toBe(false);

    expect(
      shouldPollTorrentsOnly({
        pollingPaused: false,
        isDisengaged: true,
        isWithinEngagementGrace: true,
        autoStartEnabled: true,
        hasQueuedTorrents: true,
      })
    ).toBe(false);

    expect(
      shouldPollTorrentsOnly({
        pollingPaused: true,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
        hasQueuedTorrents: true,
      })
    ).toBe(true);

    expect(
      shouldPollTorrentsOnly({
        pollingPaused: true,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: false,
        hasQueuedTorrents: false,
      })
    ).toBe(false);
  });
});

describe('resolveAuxPollInterval', () => {
  const activeMs = POLLING_CONFIG.healthActiveIntervalMs;
  const backgroundMs = POLLING_CONFIG.healthBackgroundIntervalMs;

  it('uses active interval when engaged without media', () => {
    expect(
      resolveAuxPollInterval({
        pollingPaused: false,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        activeIntervalMs: activeMs,
        backgroundIntervalMs: backgroundMs,
      })
    ).toEqual({
      intervalMs: activeMs,
      shouldPoll: true,
    });
  });

  it('uses background interval when tab is disengaged', () => {
    expect(
      resolveAuxPollInterval({
        pollingPaused: false,
        isDisengaged: true,
        isWithinEngagementGrace: false,
        activeIntervalMs: activeMs,
        backgroundIntervalMs: backgroundMs,
      }).intervalMs
    ).toBe(backgroundMs);
  });

  it('uses active interval during engagement grace', () => {
    expect(
      resolveAuxPollInterval({
        pollingPaused: false,
        isDisengaged: true,
        isWithinEngagementGrace: true,
        activeIntervalMs: activeMs,
        backgroundIntervalMs: backgroundMs,
      }).intervalMs
    ).toBe(activeMs);
  });

  it('uses background interval when media is playing', () => {
    expect(
      resolveAuxPollInterval({
        pollingPaused: true,
        isDisengaged: false,
        isWithinEngagementGrace: false,
        activeIntervalMs: POLLING_CONFIG.notificationsActiveIntervalMs,
        backgroundIntervalMs: POLLING_CONFIG.notificationsBackgroundIntervalMs,
      }).intervalMs
    ).toBe(POLLING_CONFIG.notificationsBackgroundIntervalMs);
  });
});
