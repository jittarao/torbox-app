import { describe, expect, test } from 'bun:test';
import { getUploadDeferralStatistics, isTransientDeferralMessage } from '../uploadDeferral.js';

describe('uploadDeferral', () => {
  test('isTransientDeferralMessage recognizes auto-retry deferral strings', () => {
    expect(
      isTransientDeferralMessage('Uncached rate limit reached. Will retry automatically.')
    ).toBe(true);
    expect(isTransientDeferralMessage('Rate limit reached. Will retry automatically.')).toBe(true);
    expect(isTransientDeferralMessage('File not found')).toBe(false);
    expect(isTransientDeferralMessage(null)).toBe(false);
  });

  test('getUploadDeferralStatistics aggregates deferred queued uploads by type', () => {
    const userDb = {
      db: {
        prepare() {
          return {
            all: () => [
              { type: 'torrent', deferred_count: 3, deferred_until: '2026-07-21 02:00:00' },
              { type: 'webdl', deferred_count: 1, deferred_until: '2026-07-21 01:30:00' },
            ],
          };
        },
      },
    };

    const stats = getUploadDeferralStatistics(userDb);
    expect(stats.byType.torrent.deferredCount).toBe(3);
    expect(stats.byType.usenet.deferredCount).toBe(0);
    expect(stats.byType.webdl.deferredCount).toBe(1);
    expect(stats.retryAt).toBe('2026-07-21 01:30:00');
  });
});
