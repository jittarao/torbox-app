import crypto from 'crypto';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/** Cached derived encryption key (computed once per process) */
let _cachedKey = null;

/**
 * Get encryption key from environment or generate a default (for development only).
 * Result is cached to avoid repeated scrypt derivation.
 */
function getEncryptionKey() {
  if (_cachedKey) return _cachedKey;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Development fallback - DO NOT USE IN PRODUCTION
    logger.warn('Using default encryption key. Set ENCRYPTION_KEY in production!');
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
  if (!text) {
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
  if (process.env.NODE_ENV === 'production') {
    throw new Error('HMAC_SECRET environment variable is required in production');
  }
  logger.warn(
    'HMAC_SECRET not set. API key hashing uses plain SHA-256. Set HMAC_SECRET in production.'
  );
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
