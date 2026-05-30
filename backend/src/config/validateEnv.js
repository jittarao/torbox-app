import logger from '../utils/logger.js';

/**
 * Fail fast on unsafe environment variables.
 *
 * Intentional: ENCRYPTION_KEY is optional (legacy default in crypto.js) so existing
 * encrypted API keys keep working after upgrade; missing/short keys only warn at startup.
 */
const WEAK_KEYS = [
  'dev-key-change-me',
  'change-me-please!',
  'development',
  'default-dev-key',
  'default',
  'test-key',
  'dev-key',
];

export function validateEnv() {
  const errors = [];

  const key = process.env.ENCRYPTION_KEY;
  if (!key || typeof key !== 'string' || key.trim().length < 16) {
    logger.warn(
      '[validateEnv] ENCRYPTION_KEY is not set or is shorter than 16 characters. ' +
        'The backend will use the legacy default key so existing encrypted API keys keep working. ' +
        'Set ENCRYPTION_KEY (e.g. `openssl rand -base64 32`) for new deployments.'
    );
  } else if (WEAK_KEYS.some((weak) => key.trim().toLowerCase().includes(weak))) {
    errors.push(
      'ENCRYPTION_KEY appears to be a placeholder or weak key. Generate a secure key with `openssl rand -base64 32`.'
    );
  }

  if (errors.length > 0) {
    const message = `[validateEnv] Invalid configuration:\n${errors.join('\n')}`;
    console.error(message);
    throw new Error(message);
  }
}
