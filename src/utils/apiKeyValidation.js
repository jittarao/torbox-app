/**
 * TorBox API key format: UUID
 * 8-4-4-4-12 lowercase hex with hyphens.
 */
const TORBOX_API_KEY_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTorboxApiKey(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && TORBOX_API_KEY_REGEX.test(trimmed);
}
