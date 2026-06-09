import { createHash } from 'crypto';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Normalize an infohash for comparison (hex, base32, or passthrough lowercase).
 * @param {string|null|undefined} hash
 * @returns {string|null} Lowercase hex when decodable, otherwise lowercase raw string
 */
export function normalizeInfoHash(hash) {
  if (!hash || typeof hash !== 'string') return null;
  const trimmed = hash.trim();
  if (trimmed.length === 0) return null;
  const lower = trimmed.toLowerCase();
  if (/^[a-f0-9]{40}$/.test(lower)) return lower;
  if (/^[a-z2-7]{32}$/.test(lower)) return decodeBase32Infohash(lower);
  return lower;
}

/**
 * Decode a base32-encoded infohash (common in magnet links).
 * @param {string} encoded
 * @returns {string|null} Lowercase hex hash
 */
function decodeBase32Infohash(encoded) {
  const input = encoded.replace(/=+$/, '').toLowerCase();
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  if (bytes.length !== 20) return null;
  return Buffer.from(bytes).toString('hex');
}

/**
 * Extract infohash from a magnet URI.
 * @param {string} magnet
 * @returns {string|null} Lowercase hex hash
 */
export function extractHashFromMagnet(magnet) {
  if (typeof magnet !== 'string' || magnet.trim() === '') return null;

  const hexMatch = magnet.match(/btih:([a-fA-F0-9]{40})/i);
  if (hexMatch) return hexMatch[1].toLowerCase();

  const base32Match = magnet.match(/btih:([a-zA-Z2-7]{32})/i);
  if (base32Match) return decodeBase32Infohash(base32Match[1]);

  return null;
}

function readLength(buffer, pos) {
  let length = 0;
  while (pos.i < buffer.length && buffer[pos.i] !== 0x3a) {
    const digit = buffer[pos.i] - 0x30;
    if (digit < 0 || digit > 9) throw new Error('Invalid bencode length');
    length = length * 10 + digit;
    pos.i++;
  }
  if (buffer[pos.i] !== 0x3a) throw new Error('Invalid bencode length delimiter');
  pos.i++;
  return length;
}

function bencodeDecode(buffer, pos = { i: 0 }) {
  if (pos.i >= buffer.length) throw new Error('Unexpected end of bencode data');

  const marker = buffer[pos.i];
  if (marker === 0x69) {
    pos.i++;
    const end = buffer.indexOf(0x65, pos.i);
    if (end === -1) throw new Error('Invalid bencode integer');
    const value = Number.parseInt(buffer.toString('ascii', pos.i, end), 10);
    pos.i = end + 1;
    return value;
  }

  if (marker === 0x6c) {
    pos.i++;
    const list = [];
    while (pos.i < buffer.length && buffer[pos.i] !== 0x65) {
      list.push(bencodeDecode(buffer, pos));
    }
    pos.i++;
    return list;
  }

  if (marker === 0x64) {
    pos.i++;
    const dict = {};
    while (pos.i < buffer.length && buffer[pos.i] !== 0x65) {
      const keyBuffer = bencodeDecode(buffer, pos);
      const key = Buffer.isBuffer(keyBuffer) ? keyBuffer.toString('utf8') : String(keyBuffer);
      dict[key] = bencodeDecode(buffer, pos);
    }
    pos.i++;
    return dict;
  }

  if (marker >= 0x30 && marker <= 0x39) {
    const length = readLength(buffer, pos);
    const value = buffer.subarray(pos.i, pos.i + length);
    pos.i += length;
    return value;
  }

  throw new Error('Unsupported bencode marker');
}

function bencodeEncode(value) {
  if (typeof value === 'number') {
    return Buffer.from(`i${value}e`, 'ascii');
  }

  if (Buffer.isBuffer(value)) {
    return Buffer.concat([Buffer.from(`${value.length}:`, 'ascii'), value]);
  }

  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from(`${bytes.length}:`, 'ascii'), bytes]);
  }

  if (Array.isArray(value)) {
    const parts = [Buffer.from('l', 'ascii')];
    for (const item of value) {
      parts.push(bencodeEncode(item));
    }
    parts.push(Buffer.from('e', 'ascii'));
    return Buffer.concat(parts);
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = [Buffer.from('d', 'ascii')];
    for (const key of keys) {
      parts.push(bencodeEncode(key));
      parts.push(bencodeEncode(value[key]));
    }
    parts.push(Buffer.from('e', 'ascii'));
    return Buffer.concat(parts);
  }

  throw new Error('Unsupported bencode value');
}

/**
 * Compute the infohash from a .torrent file buffer.
 * @param {Buffer} buffer
 * @returns {string|null} Lowercase hex hash
 */
export function extractInfoHashFromTorrentBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  try {
    const decoded = bencodeDecode(buffer);
    if (!decoded?.info || typeof decoded.info !== 'object') return null;
    const infoBencoded = bencodeEncode(decoded.info);
    return createHash('sha1').update(infoBencoded).digest('hex');
  } catch {
    return null;
  }
}
