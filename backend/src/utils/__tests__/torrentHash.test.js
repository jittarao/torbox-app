import { describe, expect, test } from 'bun:test';
import { createHash } from 'crypto';
import {
  extractHashFromMagnet,
  extractInfoHashFromTorrentBuffer,
} from '../torrentHash.js';

function bencode(value) {
  if (typeof value === 'number') return `i${value}e`;
  if (typeof value === 'string') return `${Buffer.byteLength(value, 'utf8')}:${value}`;
  if (Buffer.isBuffer(value)) return `${value.length}:${value.toString('binary')}`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value).sort();
    return `d${keys.map((key) => `${bencode(key)}${bencode(value[key])}`).join('')}e`;
  }
  throw new Error('unsupported');
}

describe('torrentHash', () => {
  test('extractHashFromMagnet reads hex btih', () => {
    expect(
      extractHashFromMagnet('magnet:?xt=urn:btih:ABCDEF0123456789ABCDEF0123456789ABCDEF01&dn=test')
    ).toBe('abcdef0123456789abcdef0123456789abcdef01');
  });

  test('extractInfoHashFromTorrentBuffer computes SHA1 of info dict', () => {
    const info = {
      name: 'example.torrent',
      length: 123,
    };
    const torrent = Buffer.from(
      bencode({
        announce: 'http://tracker.example/announce',
        info,
      }),
      'binary'
    );
    const expected = createHash('sha1').update(Buffer.from(bencode(info), 'binary')).digest('hex');
    expect(extractInfoHashFromTorrentBuffer(torrent)).toBe(expected);
  });
});
