import { describe, expect, it } from 'bun:test';
import { resolvePollInterval, shouldPollTorrentsOnly } from '../pollInterval';
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

  it('uses 15min when disengaged, auto-start on, and queue is empty', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: true,
      hasQueuedTorrents: false,
    });
    expect(result.intervalMs).toBe(15 * 60_000);
    expect(result.mode).toBe('autoStartWatch');
  });

  it('stops polling when disengaged without auto-start', () => {
    const result = resolvePollInterval({
      pollingPaused: false,
      isDisengaged: true,
      isWithinEngagementGrace: false,
      autoStartEnabled: false,
      hasQueuedTorrents: true,
    });
    expect(result.shouldPoll).toBe(false);
    expect(result.mode).toBe('inactive');
  });
});

describe('shouldPollTorrentsOnly', () => {
  it('is true only in background auto-start phase', () => {
    expect(
      shouldPollTorrentsOnly({
        isDisengaged: true,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
      })
    ).toBe(true);

    expect(
      shouldPollTorrentsOnly({
        isDisengaged: false,
        isWithinEngagementGrace: false,
        autoStartEnabled: true,
      })
    ).toBe(false);

    expect(
      shouldPollTorrentsOnly({
        isDisengaged: true,
        isWithinEngagementGrace: true,
        autoStartEnabled: true,
      })
    ).toBe(false);
  });
});
