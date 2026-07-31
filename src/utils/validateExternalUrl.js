/**
 * Validate that a user-supplied URL is safe for server-side fetch.
 * Returns { valid: true, url } or { valid: false, reason }.
 */

export function stripIpv6Brackets(hostname) {
  const host = String(hostname || '');
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1);
  }
  return host;
}

/**
 * Convert a trailing dotted IPv4 in an IPv6 literal to two hextets
 * so expandIPv6 always sees 8 hextet-shaped segments.
 * e.g. ::ffff:127.0.0.1 → ::ffff:7f00:1
 */
function normalizeEmbeddedIpv4(address) {
  const match = String(address)
    .toLowerCase()
    .match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (!match) return address;

  const octets = match[2].split('.').map(Number);
  if (octets.some((o) => o > 255)) throw new Error('Invalid IPv6');
  const hi = ((octets[0] << 8) | octets[1]).toString(16);
  const lo = ((octets[2] << 8) | octets[3]).toString(16);
  return `${match[1]}${hi}:${lo}`;
}

/**
 * If parts are IPv4-mapped (::ffff:x:x), return dotted IPv4; else null.
 */
function ipv4FromMappedParts(parts) {
  if (parts.length !== 8) return null;
  const prefixZero = parts.slice(0, 5).every((p) => parseInt(p, 16) === 0);
  if (!prefixZero) return null;
  if (parseInt(parts[5], 16) !== 0xffff) return null;

  const hi = parseInt(parts[6], 16);
  const lo = parseInt(parts[7], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;

  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function checkIpv4Mapped(parts) {
  const mapped = ipv4FromMappedParts(parts);
  if (!mapped) return false;
  return isPrivateOrReservedIp(mapped);
}

export function validateExternalUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' };
  }

  if (url.username || url.password) {
    return { valid: false, reason: 'URLs containing credentials are not allowed' };
  }

  const hostname = stripIpv6Brackets(url.hostname.toLowerCase());

  const blockedHostnames = new Set([
    'localhost',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    'metadata.azure.onmicrosoft.com',
    '169.254.169.254',
  ]);

  if (blockedHostnames.has(hostname)) {
    return { valid: false, reason: 'Blocked hostname' };
  }

  if (isPrivateOrReservedIp(hostname)) {
    return { valid: false, reason: 'Private or internal IP addresses are not allowed' };
  }

  return { valid: true, url: url.toString() };
}

export function isPrivateOrReservedIp(hostname) {
  const host = stripIpv6Brackets(String(hostname || '').toLowerCase());

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((o) => o > 255)) return true;
    const [a, b] = octets;

    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224 && a <= 239) return true;
    if (a === 0 || a === 255) return true;
    if (a === 192 && b === 0 && octets[2] === 2) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 203 && b === 0 && octets[2] === 113) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  if (host.includes(':')) {
    let expanded;
    try {
      expanded = expandIPv6(host);
    } catch {
      return true;
    }

    const parts = expanded.split(':');
    const first = parseInt(parts[0], 16);

    if (parts.every((p, i) => (i === 7 ? p === '0001' : p === '0000'))) return true;
    if ((first & 0xffc0) === 0xfe80) return true;
    if ((first & 0xfe00) === 0xfc00) return true;
    if ((first & 0xff00) === 0xff00) return true;
    if (checkIpv4Mapped(parts)) return true;

    return false;
  }

  return false;
}

function expandIPv6(address) {
  let normalized = normalizeEmbeddedIpv4(stripIpv6Brackets(address).toLowerCase());
  const doubleColon = normalized.indexOf('::');

  if (doubleColon !== -1) {
    let left = normalized.slice(0, doubleColon);
    let right = normalized.slice(doubleColon + 2);
    if (left === '') left = '0';
    if (right === '') right = '0';
    const leftParts = left.split(':').filter(Boolean);
    const rightParts = right.split(':').filter(Boolean);
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) throw new Error('Invalid IPv6');
    normalized = [...leftParts, ...Array(missing).fill('0'), ...rightParts].join(':');
  }

  const parts = normalized.split(':');
  if (parts.length !== 8) throw new Error('Invalid IPv6');
  if (parts.some((p) => !/^[0-9a-f]{1,4}$/i.test(p))) throw new Error('Invalid IPv6');

  return parts.map((p) => p.padStart(4, '0')).join(':');
}
