import { describe, expect, test } from 'bun:test';
import { buildExternalPlayerUrl, extractHlsUrl, parseStreamMetadata } from '@/utils/streamUrl';

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

  test('buildExternalPlayerUrl builds player-specific deep links', () => {
    const streamUrl = 'https://example.com/video.m3u8?token=abc';
    expect(buildExternalPlayerUrl('infuse', streamUrl)).toBe(
      'infuse://x-callback-url/play?url=' + streamUrl
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
