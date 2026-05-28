/**
 * Normalize Express req.ip (may be IPv4-mapped IPv6).
 * @param {string|undefined} ip
 * @returns {string}
 */
function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return '';
  }
  return ip.replace(/^::ffff:/, '');
}

/**
 * True for loopback and RFC1918 addresses (Docker bridge, LAN, etc.).
 * Used to skip IP rate limits for traffic from the Next.js proxy on the same host/network.
 * @param {string|undefined} ip
 * @returns {boolean}
 */
export function isPrivateOrLoopbackIp(ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) {
    return false;
  }
  if (normalized === '127.0.0.1' || normalized === '::1') {
    return true;
  }
  if (normalized.startsWith('10.')) {
    return true;
  }
  if (normalized.startsWith('192.168.')) {
    return true;
  }
  // 172.16.0.0 – 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * @param {string|undefined} envVal
 * @param {number} defaultVal
 * @returns {number}
 */
export function parseRateLimitMax(envVal, defaultVal) {
  const n = parseInt(envVal ?? String(defaultVal), 10);
  if (Number.isNaN(n) || n < 1) {
    return defaultVal;
  }
  return n;
}
