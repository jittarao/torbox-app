import { describe, expect, test } from 'bun:test';
import { isQueuedItem, isActiveDownload } from '../utility';

describe('isQueuedItem', () => {
  test('classic queued row (no download_state)', () => {
    expect(isQueuedItem({ id: 1, active: false })).toBe(true);
  });

  test('queued via status field from getqueued API', () => {
    expect(isQueuedItem({ id: 1, status: 'queued', download_state: 'paused' })).toBe(true);
  });

  test('queued via download_state', () => {
    expect(isQueuedItem({ id: 1, download_state: 'queued', active: false })).toBe(true);
  });

  test('active downloading torrent is not queued', () => {
    expect(
      isQueuedItem({
        id: 1,
        active: true,
        download_finished: false,
        download_state: 'downloading',
      })
    ).toBe(false);
  });

  test('completed torrent is not queued', () => {
    expect(
      isQueuedItem({
        id: 1,
        active: false,
        download_finished: true,
        download_present: true,
      })
    ).toBe(false);
  });
});

describe('isActiveDownload', () => {
  test('normalizes API active variants', () => {
    expect(isActiveDownload({ active: true })).toBe(true);
    expect(isActiveDownload({ active: 1 })).toBe(true);
    expect(isActiveDownload({ active: 'true' })).toBe(true);
    expect(isActiveDownload({ active: false })).toBe(false);
    expect(isActiveDownload({ active: 0 })).toBe(false);
  });
});
