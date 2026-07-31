import { describe, expect, test } from 'bun:test';
import { parseMediaId, inferTypesForMediaId, addonSupportsQuery } from '../stremioMediaId.js';
import { normalizeStream, mergeStreams, streamToUploadTarget } from '../stremioStreamNormalize.js';

describe('stremioMediaId', () => {
  test('parses imdb movie and episode ids', () => {
    expect(parseMediaId('tt0111161').ok).toBe(true);
    expect(parseMediaId('tt0944947:1:1').mediaId).toBe('tt0944947:1:1');
  });

  test('parses prefixed ids', () => {
    expect(parseMediaId('anilist:16498').mediaId).toBe('anilist:16498');
    expect(parseMediaId('foo:1').ok).toBe(false);
    expect(parseMediaId('foo:1', ['foo']).ok).toBe(true);
  });

  test('infers types', () => {
    expect(inferTypesForMediaId('tt0111161')).toEqual(['movie', 'series']);
    expect(inferTypesForMediaId('tt0944947:1:1')).toEqual(['series']);
    expect(inferTypesForMediaId('anilist:16498')).toEqual(['anime']);
  });

  test('addonSupportsQuery respects types and prefixes', () => {
    const addon = {
      enabled: true,
      types: ['movie', 'series'],
      id_prefixes: ['tt'],
    };
    expect(addonSupportsQuery(addon, 'tt0111161', 'movie')).toBe(true);
    expect(addonSupportsQuery(addon, 'tt0111161', 'anime')).toBe(false);
    expect(addonSupportsQuery(addon, 'anilist:1', 'movie')).toBe(false);
  });
});

describe('stremioStreamNormalize', () => {
  test('normalizes stream metadata and upload target', () => {
    const stream = normalizeStream(
      {
        name: 'Movie 1080p x265 HDR',
        description: 'ENG 5.1 12.5 GB',
        infoHash: 'ABCDEF1234567890ABCDEF1234567890ABCDEF12',
        behaviorHints: { cached: true, videoSize: 13421772800 },
      },
      { addonId: 'com.test', addonName: 'Test', sortOrder: 0 }
    );

    expect(stream.resolution).toBe('1080p');
    expect(stream.codec).toBe('x265');
    expect(stream.hdr).toBe('HDR');
    expect(stream.cached).toBe(true);
    expect(stream.infoHash).toBe('abcdef1234567890abcdef1234567890abcdef12');

    const target = streamToUploadTarget(stream);
    expect(target.kind).toBe('magnet');
    expect(target.data).toContain('btih:abcdef1234567890abcdef1234567890abcdef12');
  });

  test('merges duplicates by infoHash', () => {
    const a = normalizeStream(
      { name: 'A', infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { addonId: 'a', addonName: 'A' }
    );
    const b = normalizeStream(
      {
        name: 'B 1080p',
        infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        behaviorHints: { cached: true },
      },
      { addonId: 'b', addonName: 'B' }
    );
    const merged = mergeStreams([a], [b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toHaveLength(2);
    expect(merged[0].cached).toBe(true);
  });

  test('accepts base32 infoHash and magnet url streams', () => {
    // 20 zero bytes → base32 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (padless 32 a's)
    // Use a known base32 → hex pair: SHA1 of empty... better use fixed vector
    // "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" is invalid length chars; use 32 valid base32 chars
    const b32 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const fromB32 = normalizeStream(
      { name: 'Base32', infoHash: b32 },
      { addonId: 'x', addonName: 'X' }
    );
    expect(fromB32).not.toBeNull();
    expect(fromB32.infoHash).toMatch(/^[a-f0-9]{40}$/);
    expect(streamToUploadTarget(fromB32).kind).toBe('magnet');

    const fromMagnet = normalizeStream(
      {
        name: 'Magnet only',
        url: 'magnet:?xt=urn:btih:abcdef1234567890abcdef1234567890abcdef12&dn=test',
      },
      { addonId: 'x', addonName: 'X' }
    );
    expect(fromMagnet).not.toBeNull();
    expect(fromMagnet.infoHash).toBe('abcdef1234567890abcdef1234567890abcdef12');
  });

  test('lists http url streams without Add-to-TorBox upload', () => {
    const nzb = normalizeStream(
      { name: 'NZB', nzbUrl: 'https://indexer.example.com/get?id=1' },
      { addonId: 'x', addonName: 'X' }
    );
    expect(nzb).not.toBeNull();
    expect(streamToUploadTarget(nzb).canUpload).toBe(true);
    expect(streamToUploadTarget(nzb).kind).toBe('usenet');

    const direct = normalizeStream(
      {
        name: '⚡4K [TB]',
        url: 'https://cdn.example.com/file.mkv',
        behaviorHints: { videoSize: 7414250351, filename: 'file.mkv' },
      },
      { addonId: 'x', addonName: 'X' }
    );
    expect(direct).not.toBeNull();
    expect(direct.size).toBe(7414250351);
    expect(direct.filename).toBe('file.mkv');
    const target = streamToUploadTarget(direct);
    expect(target.kind).toBe('link');
    expect(target.canUpload).toBe(false);
    expect(target.copyValue).toContain('cdn.example.com');

    const withLangInFilename = normalizeStream(
      {
        name: '⚡ 4K [TB]',
        url: 'https://cdn.example.com/movie.mkv',
        behaviorHints: {
          filename: 'Movie.2024.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1.Atmos-GROUP.ENG.mkv',
        },
      },
      { addonId: 'x', addonName: 'X' }
    );
    expect(withLangInFilename).not.toBeNull();
    expect(withLangInFilename.language).toMatch(/eng/i);
    expect(withLangInFilename.resolution).toBe('2160p');
    expect(withLangInFilename.codec).toBe('x265');
    expect(withLangInFilename.quality).toBe('BluRay');

    // Filename wins over a misleading short title (720p label vs 1080p scene name).
    const filenameWins = normalizeStream(
      {
        name: '720p WEB',
        infoHash: 'abcdef1234567890abcdef1234567890abcdef12',
        behaviorHints: {
          filename:
            'The.Series.Title.2010.S01E01.ATVP.WEBDL-1080p.EAC3.Atmos.5.1.DV.HDR10Plus.h265-RlsGrp.mkv',
        },
      },
      { addonId: 'x', addonName: 'X' }
    );
    expect(filenameWins.resolution).toBe('1080p');
    expect(filenameWins.codec).toBe('x265');
    expect(filenameWins.hdr).toBe('DV');
    expect(filenameWins.quality).toBe('WEB-DL');

    const external = normalizeStream(
      { name: 'External', externalUrl: 'https://netflix.com/watch/1' },
      { addonId: 'x', addonName: 'X' }
    );
    expect(external).toBeNull();
  });
});
