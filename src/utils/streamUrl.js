/**
 * Extract HLS stream URL from a createStream API response.
 */
export function extractHlsUrl(streamResponse) {
  const data = streamResponse?.data || streamResponse;
  return data?.hls_url || streamResponse?.hls_url || null;
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
