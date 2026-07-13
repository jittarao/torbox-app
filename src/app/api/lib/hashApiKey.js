import crypto from 'crypto';

/**
 * Hash an API key to a stable user identifier (matches backend authId).
 * @param {string} apiKey
 */
export function hashApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
