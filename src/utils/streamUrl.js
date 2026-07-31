/**
 * Extract HLS stream URL from a createStream API response.
 */
export function extractHlsUrl(streamResponse) {
  const data = streamResponse?.data || streamResponse;
  return data?.hls_url || streamResponse?.hls_url || null;
}

/**
 * True when the URL should be loaded via an adaptive player (Shaka / MSE).
 * Progressive CDN links (TorBox requestdl, Stremio resolve) lack CORS for MSE
 * and must use native HTMLMediaElement playback instead.
 *
 * @param {string|null|undefined} url
 * @returns {boolean}
 */
export function isAdaptiveStreamUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  // Strip query/hash for extension checks while still matching common HLS paths.
  let path = trimmed;
  try {
    path = new URL(trimmed).pathname;
  } catch {
    path = trimmed.split(/[?#]/)[0] || trimmed;
  }
  return /\.m3u8$/i.test(path) || /\.mpd$/i.test(path);
}

/**
 * Human-readable message from Shaka / DOM / generic player errors.
 * Shaka errors often serialize as `{}` when only code/category are set.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function formatPlayerError(error) {
  if (error == null) return 'Failed to load stream';
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  if (error?.code != null) {
    const category = error.category != null ? ` (category ${error.category})` : '';
    return `Player error ${error.code}${category}`;
  }
  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}' && json !== 'null') return json;
  } catch {
    // ignore
  }
  const asString = String(error);
  if (asString && asString !== '[object Object]') return asString;
  return 'Failed to load stream';
}

/**
 * Build deep-link URL for an external media player.
 * @param {'infuse' | 'iina' | 'stremio'} player
 * @param {string} streamUrl
 * @param {{ filename?: string }} [options]
 */
export function buildExternalPlayerUrl(player, streamUrl, options = {}) {
  switch (player) {
    case 'infuse': {
      // Infuse requires encoded query values; optional filename helps format detection.
      const params = new URLSearchParams();
      params.set('url', streamUrl);
      const filename = options.filename?.trim();
      if (filename) {
        params.set('filename', filename);
      }
      return `infuse://x-callback-url/play?${params.toString()}`;
    }
    case 'iina':
      return `iina://weblink?url=${streamUrl}`;
    case 'stremio': {
      const separator = streamUrl.includes('?') ? '&' : '?';
      const stremioUrl = `${streamUrl}${separator}filename=stremio.mkv`;
      return `stremio://search?search=${encodeURIComponent(stremioUrl)}`;
    }
    default:
      throw new Error(`Unknown external player: ${player}`);
  }
}

/**
 * Parse stream metadata from a createStream API response.
 */
export function parseStreamMetadata(streamResponse) {
  const data = streamResponse?.data || streamResponse;
  const metadata = data?.metadata || streamResponse?.metadata || {};
  return {
    metadata: {
      ...metadata,
      search_metadata: data?.search_metadata || streamResponse?.search_metadata || null,
    },
    introInformation: data?.intro_information || streamResponse?.intro_information || null,
  };
}
