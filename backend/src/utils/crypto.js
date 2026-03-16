import crypto from 'crypto';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Cached derived encryption key (computed once per process).
 * Key rotation requires a process restart. Tests that set ENCRYPTION_KEY
 * after the first encrypt/decrypt call will not see the new key until the cache
 * is cleared or the process restarts.
 */
let _cachedKey = null;

/**
 * Get encryption key from environment or generate a default (for development only).
 * Result is cached to avoid repeated scrypt derivation.
 */
function getEncryptionKey() {
  if (_cachedKey) return _cachedKey;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Fallback for backward compatibility when ENCRYPTION_KEY is not set
    if (process.env.NODE_ENV === 'production') {
      logger.warn('ENCRYPTION_KEY not set. Using default key. Set ENCRYPTION_KEY in production for stronger security.');
    } else {
      logger.warn('Using default encryption key. Set ENCRYPTION_KEY in production!');
    }
    _cachedKey = crypto.scryptSync('default-dev-key-change-in-production', 'salt', 32);
    return _cachedKey;
  }

  // Salt from env so it can be unique per installation (default for backward compatibility)
  const salt = process.env.ENCRYPTION_SALT || 'torbox-salt';
  if (!process.env.ENCRYPTION_SALT) {
    logger.warn(
      'ENCRYPTION_SALT not set. Using default salt; set a unique value per installation in production.'
    );
  }
  _cachedKey = crypto.scryptSync(key, salt, 32);
  return _cachedKey;
}

/**
 * Encrypt a string value
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string (hex encoded)
 */
export function encrypt(text) {
  if (text == null) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV + tag + encrypted data
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption error', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string value
 * @param {string} encryptedText - Encrypted string (hex encoded)
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption error', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * SHA-256 hash of API key (no secret). Used for legacy authIds and for dual-hash resolution when HMAC_SECRET is set.
 * @param {string} apiKey - API key to hash
 * @returns {string} - Hash (hex encoded)
 */
export function sha256HashApiKey(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Hash an API key to create a unique user identifier.
 * Uses HMAC with HMAC_SECRET when set (recommended for production); otherwise SHA-256 for backward compatibility.
 * @param {string} apiKey - API key to hash
 * @returns {string} - Hash of the API key (hex encoded)
 */
export function hashApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  const secret = process.env.HMAC_SECRET;
  if (secret) {
    return crypto.createHmac('sha256', secret).update(apiKey).digest('hex');
  }
  // Backward compatibility: use SHA-256 when HMAC_SECRET is not set
  if (process.env.NODE_ENV === 'production') {
    logger.warn(
      'HMAC_SECRET not set. API key hashing uses SHA-256. Set HMAC_SECRET in production for stronger security.'
    );
  } else {
    logger.warn('HMAC_SECRET not set. API key hashing uses plain SHA-256. Set HMAC_SECRET in production.');
  }
  return sha256HashApiKey(apiKey);
}

/**
 * Return candidate authIds for an API key for lookup. When HMAC_SECRET is set, returns [HMAC hash, SHA-256 hash]
 * so existing users (stored under SHA-256) still resolve; new users use the first candidate (HMAC).
 * When HMAC_SECRET is not set, returns a single SHA-256 hash.
 * @param {string} apiKey - API key to hash
 * @returns {string[]} - One or two 64-char hex strings (no duplicates)
 */
export function getAuthIdCandidates(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  const sha = sha256HashApiKey(apiKey);
  const secret = process.env.HMAC_SECRET;
  if (!secret) return [sha];
  const hmac = crypto.createHmac('sha256', secret).update(apiKey).digest('hex');
  return hmac === sha ? [sha] : [hmac, sha];
}
