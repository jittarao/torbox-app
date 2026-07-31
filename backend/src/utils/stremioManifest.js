/**
 * Stremio manifest parsing and stream URL helpers.
 * Provider-agnostic — no addon-specific logic.
 */

/**
 * Strip trailing /manifest.json (case-insensitive) to get the addon base URL.
 */
export function getAddonBaseUrl(manifestUrl) {
  const url = new URL(manifestUrl);
  let pathname = url.pathname;
  if (/\/manifest\.json$/i.test(pathname)) {
    pathname = pathname.replace(/\/manifest\.json$/i, '');
  }
  // Avoid empty path becoming "/"
  url.pathname = pathname || '';
  // Remove trailing slash for consistent joining
  const base = url.toString().replace(/\/$/, '');
  return base;
}

/**
 * Build Stremio stream resource URL.
 * mediaId may contain colons (e.g. tt0944947:1:1) — encodeURIComponent each path segment.
 */
export function buildStreamUrl(manifestUrl, type, mediaId) {
  const base = getAddonBaseUrl(manifestUrl);
  const encodedId = encodeURIComponent(mediaId);
  return `${base}/stream/${encodeURIComponent(type)}/${encodedId}.json`;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.length > 0);
}

/**
 * Normalize resources array (strings or objects) and find the stream resource.
 */
export function findStreamResource(resources) {
  if (!Array.isArray(resources)) return null;

  for (const entry of resources) {
    if (typeof entry === 'string' && entry === 'stream') {
      return { name: 'stream', types: null, idPrefixes: null };
    }
    if (entry && typeof entry === 'object' && entry.name === 'stream') {
      return {
        name: 'stream',
        types: asStringArray(entry.types),
        idPrefixes: asStringArray(entry.idPrefixes),
      };
    }
  }
  return null;
}

/**
 * Validate and extract persisted fields from a Stremio manifest JSON object.
 * @returns {{ ok: true, data } | { ok: false, error: string }}
 */
export function validateAndExtractManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, error: 'Manifest must be a JSON object' };
  }

  const addonId = typeof manifest.id === 'string' ? manifest.id.trim() : '';
  const name = typeof manifest.name === 'string' ? manifest.name.trim() : '';

  if (!addonId) {
    return { ok: false, error: 'Manifest is missing id' };
  }
  if (!name) {
    return { ok: false, error: 'Manifest is missing name' };
  }

  const streamResource = findStreamResource(manifest.resources);
  if (!streamResource) {
    return {
      ok: false,
      error: 'Addon does not expose a Stream resource',
    };
  }

  const types =
    streamResource.types?.length > 0 ? streamResource.types : asStringArray(manifest.types);

  const idPrefixes =
    streamResource.idPrefixes?.length > 0
      ? streamResource.idPrefixes
      : asStringArray(manifest.idPrefixes);

  // If stream resource is a bare string, types/idPrefixes come only from top-level
  // Empty types/idPrefixes means "unspecified" — client may still query; we store as []

  return {
    ok: true,
    data: {
      addonId,
      name,
      version: typeof manifest.version === 'string' ? manifest.version : null,
      logo: sanitizeLogoUrl(manifest.logo),
      description:
        typeof manifest.description === 'string' ? manifest.description.slice(0, 2000) : null,
      resources: Array.isArray(manifest.resources) ? manifest.resources : [],
      types,
      idPrefixes,
    },
  };
}

function sanitizeLogoUrl(logo) {
  if (typeof logo !== 'string') return null;
  const trimmed = logo.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Ensure mediaId matches an idPrefix when prefixes are declared.
 * Empty prefixes = allow all (manifest unspecified).
 */
export function mediaIdMatchesPrefixes(mediaId, idPrefixes) {
  if (!Array.isArray(idPrefixes) || idPrefixes.length === 0) return true;
  const id = String(mediaId || '');
  return idPrefixes.some((prefix) => {
    if (prefix === 'tt') {
      return /^tt\d+/i.test(id);
    }
    return id.toLowerCase().startsWith(`${prefix.toLowerCase()}:`);
  });
}
