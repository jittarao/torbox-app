import { describe, expect, test } from 'bun:test';
import {
  getAddonBaseUrl,
  buildStreamUrl,
  findStreamResource,
  validateAndExtractManifest,
  mediaIdMatchesPrefixes,
} from '../stremioManifest.js';

describe('stremioManifest', () => {
  test('getAddonBaseUrl strips manifest.json', () => {
    expect(getAddonBaseUrl('https://example.com/config/xyz/manifest.json')).toBe(
      'https://example.com/config/xyz'
    );
  });

  test('buildStreamUrl encodes media id with colons', () => {
    const url = buildStreamUrl('https://example.com/manifest.json', 'series', 'tt0944947:1:1');
    expect(url).toBe('https://example.com/stream/series/tt0944947%3A1%3A1.json');
  });

  test('findStreamResource accepts string and object forms', () => {
    expect(findStreamResource(['catalog', 'stream'])).toEqual({
      name: 'stream',
      types: null,
      idPrefixes: null,
    });
    expect(findStreamResource([{ name: 'stream', types: ['movie'], idPrefixes: ['tt'] }])).toEqual({
      name: 'stream',
      types: ['movie'],
      idPrefixes: ['tt'],
    });
    expect(findStreamResource(['catalog'])).toBeNull();
  });

  test('validateAndExtractManifest requires stream resource', () => {
    const bad = validateAndExtractManifest({
      id: 'com.test',
      name: 'Test',
      resources: ['catalog'],
    });
    expect(bad.ok).toBe(false);

    const good = validateAndExtractManifest({
      id: 'com.meteor.v5',
      name: 'Meteor',
      version: '5.0.0',
      resources: [
        {
          name: 'stream',
          types: ['movie', 'series', 'anime'],
          idPrefixes: ['tt', 'anilist'],
        },
      ],
      types: ['movie', 'series', 'anime'],
      idPrefixes: ['tt', 'anilist'],
    });
    expect(good.ok).toBe(true);
    expect(good.data.types).toEqual(['movie', 'series', 'anime']);
    expect(good.data.idPrefixes).toEqual(['tt', 'anilist']);
  });

  test('mediaIdMatchesPrefixes', () => {
    expect(mediaIdMatchesPrefixes('tt0111161', ['tt'])).toBe(true);
    expect(mediaIdMatchesPrefixes('tt0944947:1:1', ['tt'])).toBe(true);
    expect(mediaIdMatchesPrefixes('anilist:16498', ['anilist'])).toBe(true);
    expect(mediaIdMatchesPrefixes('anilist:16498', ['tt'])).toBe(false);
    expect(mediaIdMatchesPrefixes('anything', [])).toBe(true);
  });

  test('sanitizeLogoUrl keeps https only', () => {
    const withBadLogo = validateAndExtractManifest({
      id: 'com.test',
      name: 'Test',
      resources: ['stream'],
      logo: 'javascript:alert(1)',
    });
    expect(withBadLogo.ok).toBe(true);
    expect(withBadLogo.data.logo).toBeNull();

    const withHttpLogo = validateAndExtractManifest({
      id: 'com.test',
      name: 'Test',
      resources: ['stream'],
      logo: 'http://cdn.example.com/logo.png',
    });
    expect(withHttpLogo.data.logo).toBeNull();

    const withHttpsLogo = validateAndExtractManifest({
      id: 'com.test',
      name: 'Test',
      resources: ['stream'],
      logo: 'https://cdn.example.com/logo.png',
    });
    expect(withHttpsLogo.data.logo).toBe('https://cdn.example.com/logo.png');
  });
});
