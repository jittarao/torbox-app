import { describe, expect, test } from 'bun:test';
import {
  buildExternalPlayerUrl,
  extractHlsUrl,
  formatPlayerError,
  isAdaptiveStreamUrl,
  parseStreamMetadata,
} from '@/utils/streamUrl';

describe('streamUrl utils', () => {
  test('extractHlsUrl reads nested data.hls_url', () => {
    expect(extractHlsUrl({ data: { hls_url: 'https://example.com/stream.m3u8' } })).toBe(
      'https://example.com/stream.m3u8'
    );
  });

  test('extractHlsUrl reads top-level hls_url', () => {
    expect(extractHlsUrl({ hls_url: 'https://example.com/top.m3u8' })).toBe(
      'https://example.com/top.m3u8'
    );
  });

  test('isAdaptiveStreamUrl detects HLS/DASH and progressive CDN links', () => {
    expect(isAdaptiveStreamUrl('https://cdn.example.com/stream.m3u8?token=abc')).toBe(true);
    expect(isAdaptiveStreamUrl('https://cdn.example.com/manifest.mpd')).toBe(true);
    expect(
      isAdaptiveStreamUrl(
        'https://nexus-080.indi.tb-cdn.pw/dld/c1259aa6-45d2-4ac1-ad47-7de6fca25f4b?token=abc'
      )
    ).toBe(false);
    expect(isAdaptiveStreamUrl('https://cdn.example.com/file.mp4')).toBe(false);
    expect(isAdaptiveStreamUrl('')).toBe(false);
  });

  test('buildExternalPlayerUrl builds player-specific deep links', () => {
    const streamUrl = 'https://example.com/video.m3u8?token=abc';
    expect(buildExternalPlayerUrl('infuse', streamUrl)).toBe(
      'infuse://x-callback-url/play?url=' + encodeURIComponent(streamUrl)
    );
    expect(buildExternalPlayerUrl('infuse', streamUrl, { filename: 'Movie.mkv' })).toBe(
      'infuse://x-callback-url/play?url=' +
        encodeURIComponent(streamUrl) +
        '&filename=' +
        encodeURIComponent('Movie.mkv')
    );
    expect(buildExternalPlayerUrl('iina', streamUrl)).toBe('iina://weblink?url=' + streamUrl);
    expect(buildExternalPlayerUrl('stremio', streamUrl)).toBe(
      'stremio://search?search=' + encodeURIComponent(streamUrl + '&filename=stremio.mkv')
    );
  });

  test('parseStreamMetadata merges search_metadata', () => {
    const result = parseStreamMetadata({
      data: {
        metadata: { audios: [{ language: 'en' }] },
        intro_information: { start_time: 0, end_time: 90 },
        search_metadata: { title: 'Episode 1' },
      },
    });

    expect(result.metadata.audios).toHaveLength(1);
    expect(result.metadata.search_metadata).toEqual({ title: 'Episode 1' });
    expect(result.introInformation).toEqual({ start_time: 0, end_time: 90 });
  });
});

describe('formatPlayerError', () => {
  test('formats empty Shaka-like errors', () => {
    expect(formatPlayerError({})).toBe('Failed to load stream');
    expect(formatPlayerError({ code: 1002, category: 1 })).toBe('Player error 1002 (category 1)');
    expect(formatPlayerError(new Error('CORS blocked'))).toBe('CORS blocked');
  });
});
