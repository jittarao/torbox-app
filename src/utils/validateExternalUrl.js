/**
 * Validate that a user-supplied URL is safe for server-side fetch.
 * Returns { valid: true, url } or { valid: false, reason }.
 */
/**
 * Given a hostname that may contain an IPv4-mapped IPv6 suffix (dotted decimal
 * embedded in the last segment, e.g. "::ffff:127.0.0.1"), extract and re-check
 * the embedded IPv4 against private/reserved ranges.
 */
function checkIpv4Mapped(parts) {
  const last = parts[parts.length - 1];
  // Dotted decimal embedded in the last segment (common SSRF vector)
  if (last.includes('.')) {
    return isPrivateOrReservedIp(last);
  }
  return false;
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

  const hostname = url.hostname.toLowerCase();

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

function isPrivateOrReservedIp(hostname) {
  // IPv4
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((o) => o > 255)) return false;
    const [a, b, c, d] = octets;

    // Loopback (127.0.0.0/8)
    if (a === 127) return true;
    // Link-local / cloud metadata (169.254.0.0/16)
    if (a === 169 && b === 254) return true;
    // Private ranges
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Multicast (224.0.0.0/4)
    if (a >= 224 && a <= 239) return true;
    // Broadcast / zero
    if (a === 0 || a === 255) return true;
    // Documentation / benchmark / reserved
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    // CGNAT
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  // IPv6
  if (hostname.includes(':')) {
    // Expand compressed IPv6 to a normalized form for checks
    let expanded;
    try {
      expanded = expandIPv6(hostname);
    } catch {
      return false;
    }

    const parts = expanded.split(':');
    const first = parseInt(parts[0], 16);

    // Loopback ::1
    if (parts.every((p, i) => (i === 7 ? p === '0001' : p === '0000'))) return true;
    // Link-local fe80::/10
    if ((first & 0xffc0) === 0xfe80) return true;
    // Unique local fc00::/7
    if ((first & 0xfe00) === 0xfc00) return true;
    // Multicast ff00::/8
    if ((first & 0xff00) === 0xff00) return true;

    // IPv4-mapped or embedded IPv4 (e.g. ::ffff:127.0.0.1, ::ffff:c0a8:101)
    if (checkIpv4Mapped(parts)) return true;

    return false;
  }

  return false;
}

function expandIPv6(address) {
  let normalized = address.toLowerCase();
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

  return parts.map((p) => p.padStart(4, '0')).join(':');
}
