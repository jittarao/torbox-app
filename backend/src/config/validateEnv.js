/**
 * Fail fast on missing or unsafe required environment variables.
 * Call before opening databases or binding the HTTP server.
 */
export function validateEnv() {
  const errors = [];

  const key = process.env.ENCRYPTION_KEY;
  if (!key || typeof key !== 'string' || key.trim().length < 16) {
    errors.push(
      'ENCRYPTION_KEY must be set to a non-empty string (use e.g. `openssl rand -base64 32` — see backend README / AGENTS.md).'
    );
  }

  if (errors.length > 0) {
    const message = `[validateEnv] Invalid configuration:\n${errors.join('\n')}`;
    console.error(message);
    throw new Error(message);
  }
}
