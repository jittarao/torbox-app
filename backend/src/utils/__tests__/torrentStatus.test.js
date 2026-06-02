import { describe, expect, it } from 'bun:test';
import { getTorrentStatus } from '../torrentStatus.js';

describe('getTorrentStatus', () => {
  it('returns failed when download_state includes failed and not active (UI parity)', () => {
    const torrent = {
      download_state: 'failed - disk full',
      active: false,
      download_finished: true,
      download_present: true,
    };
    expect(getTorrentStatus(torrent)).toBe('failed');
  });

  it('returns failed when download_present is true but download_state is failed', () => {
    const torrent = {
      download_state: 'failed - timeout',
      active: false,
      download_finished: false,
      download_present: true,
    };
    expect(getTorrentStatus(torrent)).toBe('failed');
  });

  it('does not return failed when active is true', () => {
    const torrent = {
      download_state: 'failed - retrying',
      active: true,
      download_finished: false,
      download_present: false,
    };
    expect(getTorrentStatus(torrent)).not.toBe('failed');
  });

  it('returns stalled when download_state includes stalled and active (UI parity)', () => {
    const torrent = {
      download_state: 'stalled - no peers',
      active: true,
      download_finished: true,
      download_present: true,
    };
    expect(getTorrentStatus(torrent)).toBe('stalled');
  });

  it('returns inactive when not active and download not present', () => {
    const torrent = {
      active: false,
      download_present: false,
      download_finished: true,
    };
    expect(getTorrentStatus(torrent)).toBe('inactive');
  });
});
