import crypto from 'crypto';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY';

/** Legacy scrypt inputs used when ENCRYPTION_KEY is unset (existing self-hosted installs). */
const LEGACY_DEFAULT_SECRET = 'default-dev-key-change-in-production';
const LEGACY_DEFAULT_SALT = 'salt';

/**
 * Cached derived encryption key (computed once per process).
 * Key rotation requires a process restart.
 */
let _cachedKey = null;

/**
 * Get encryption key from environment, or the legacy default when unset.
 *
 * Intentional: ENCRYPTION_KEY stays optional so upgrades do not break installs that
 * already encrypted API keys with the legacy default. Startup warns via validateEnv();
 * new deployments should set ENCRYPTION_KEY (openssl rand -base64 32).
 *
 * @returns {Buffer}
 */
function getEncryptionKey() {
  if (_cachedKey) return _cachedKey;

  const key = process.env[ENCRYPTION_KEY_ENV];
  if (!key) {
    const message =
      `${ENCRYPTION_KEY_ENV} is not set — using legacy default encryption key. ` +
      'Set ENCRYPTION_KEY (e.g. openssl rand -base64 32) to protect stored API keys.';
    if (process.env.NODE_ENV === 'production') {
      logger.warn(message);
    } else {
      logger.warn(`[dev] ${message}`);
    }
    _cachedKey = crypto.scryptSync(LEGACY_DEFAULT_SECRET, LEGACY_DEFAULT_SALT, 32);
    return _cachedKey;
  }

  const salt = process.env.ENCRYPTION_SALT || 'torbox-salt';
  _cachedKey = crypto.scryptSync(key, salt, 32);
  return _cachedKey;
}

/**
 * Verify the encryption key is functional by encrypting and decrypting a known value.
 * Throws if the round-trip fails (wrong key, corrupted config).
 */
export function validateEncryption() {
  const testValue = '__torbox_encryption_validation__';
  const encrypted = encrypt(testValue);
  const decrypted = decrypt(encrypted);
  if (decrypted !== testValue) {
    throw new Error('Encryption round-trip validation failed: decrypted text does not match');
  }
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
 * Hash an API key to create a unique user identifier (SHA-256).
 * @param {string} apiKey - API key to hash
 * @returns {string} - Hash of the API key (hex encoded)
 */
export function hashApiKey(apiKey) {
  if (!apiKey) throw new Error('API key is required');
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Constant-time string comparison using SHA-256 hashes.
 * Useful for comparing secrets without leaking length or content via timing.
 * @param {string} a - First value
 * @param {string} b - Second value
 * @returns {boolean}
 */
export function timingSafeCompare(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return ha.length === hb.length && crypto.timingSafeEqual(ha, hb);
}
