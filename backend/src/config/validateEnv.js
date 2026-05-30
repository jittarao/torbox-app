/**
 * Fail fast on missing or unsafe required environment variables.
 * Call before opening databases or binding the HTTP server.
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
    errors.push(
      'ENCRYPTION_KEY must be set to a non-empty string of at least 16 characters (use e.g. `openssl rand -base64 32`).'
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
