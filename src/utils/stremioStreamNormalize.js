/**
 * Normalize and merge Stremio stream objects into a provider-agnostic result model.
 *
 * Technical tags (resolution / codec / HDR / language) follow common scene / P2P
 * release naming (Title.Year.2160p.UHD.BluRay.…HDR10Plus.DV.x265-GROUP).
 * @see https://rendezvois.github.io/miscellaneous/naming-conventions/encodes/
 */

const RESOLUTION_ORDER = {
  '2160p': 4,
  '1080p': 3,
  '720p': 2,
  '480p': 1,
};

/** Dot / bracket / space separators common in scene filenames */
function sceneNormalize(text) {
  return String(text || '')
    .replace(/[\[\]()]/g, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseResolution(s) {
  // Prefer explicit p/i tokens; fall back to 4K / UHD marketing tags.
  const match = s.match(/\b(8640p|4320p|2160p|1440p|1080p|1080i|720p|576p|480p|360p|4K|UHD)\b/i);
  if (!match) return null;
  const token = match[1].toUpperCase();
  if (token === '4K' || token === 'UHD' || token === '2160P') return '2160p';
  if (token === '1080I' || token === '1080P' || token === '1440P') return '1080p';
  if (token === '720P') return '720p';
  if (token === '576P' || token === '480P' || token === '360P') return '480p';
  // Ultra-high (8K/4K variants already handled); keep lowercase p form when known.
  return `${parseInt(token, 10)}p`;
}

function parseHdr(s) {
  // Longest / most specific first (HDR10Plus before HDR10 before HDR).
  if (/\b(Dolby[\s.-]*Vision|DoVi|DV)\b/i.test(s)) return 'DV';
  if (/\b(HDR10[\s.+_-]*Plus|HDR10\+)\b/i.test(s)) return 'HDR10+';
  if (/\bHDR10\b/i.test(s)) return 'HDR10';
  if (/\bHLG\b/i.test(s)) return 'HLG';
  if (/\bHDR\b/i.test(s)) return 'HDR';
  return null;
}

function parseCodec(s) {
  // Scene WEB often uses H.265 / H.264; encodes use x265 / x264; HEVC/AVC synonyms.
  const match = s.match(/\b(x265|x264|h\.?265|h\.?264|HEVC|AVC|AV1|VP9|XviD|DivX)\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase().replace(/\./g, '');
  if (raw === 'hevc' || raw === 'h265' || raw === 'x265') return 'x265';
  if (raw === 'avc' || raw === 'h264' || raw === 'x264') return 'x264';
  if (raw === 'av1') return 'AV1';
  if (raw === 'vp9') return 'VP9';
  if (raw === 'xvid') return 'XviD';
  if (raw === 'divx') return 'DivX';
  return match[1];
}

function parseAudio(s) {
  const match = s.match(
    /\b(TrueHD(?:[\s.-]*Atmos)?|DTS(?:-?HD(?:[\s.-]*MA)?|-?X)?|Atmos|DD(?:P|Plus)?(?:[\s.-]*Atmos)?(?:[\s.-]*\d+(?:\.\d+)?)?|EAC3|E-AC-?3|AC-?3|AAC|FLAC|Opus|LPCM|PCM)\b/i
  );
  return match ? match[1] : null;
}

function parseQuality(s) {
  const match = s.match(
    /\b(Blu-?Ray|UHD[\s.-]*Blu-?Ray|WEB-?DL|WEBDL|WEB-?Rip|WEBRip|WEB|HDTV|REMUX|BDRip|BRRip|DVDRip|HDRip|PPVRip)\b/i
  );
  if (!match) return null;
  const t = match[1].toLowerCase().replace(/-/g, '');
  if (t.includes('bluray') || t.includes('uhd')) return 'BluRay';
  if (t === 'webdl' || t === 'web') return 'WEB-DL';
  if (t === 'webrip') return 'WEBRip';
  if (t === 'hdtv') return 'HDTV';
  if (t === 'remux') return 'REMUX';
  if (t === 'bdrip' || t === 'brrip') return 'BDRip';
  if (t === 'dvdrip') return 'DVDRip';
  return match[1];
}

function parseLanguage(s) {
  const match = s.match(
    /\b(ENG|English|Multi|DUAL|MULTi|JPN|Japanese|SPA|Spanish|FRE|French|GER|German|ITA|Italian|RUS|Russian|POR|Portuguese|CHI|Chinese|KOR|Korean|HIN|Hindi|NLD|Dutch|SWE|Swedish|NOR|Norwegian|FIN|Finnish|POL|Polish|CES|CZE|Czech|TUR|Turkish|THA|Thai|ARA|Arabic|HEB|Hebrew|VIE|Vietnamese|IND|Indonesian|MSA|Malay|UKR|Ukrainian)\b/i
  );
  return match ? match[1] : null;
}

/**
 * Parse scene / P2P style release metadata from free text (title, description, or filename).
 */
export function parseMetadata(text) {
  const s = sceneNormalize(text);
  if (!s) {
    return {
      resolution: null,
      hdr: null,
      codec: null,
      audio: null,
      quality: null,
      language: null,
    };
  }

  return {
    resolution: parseResolution(s),
    hdr: parseHdr(s),
    codec: parseCodec(s),
    audio: parseAudio(s),
    quality: parseQuality(s),
    language: parseLanguage(s),
  };
}

/**
 * Prefer filename (authoritative scene name) over short UI title/description labels.
 */
function mergeParsedMetadata(fromLabels, fromFilename) {
  return {
    resolution: fromFilename.resolution || fromLabels.resolution,
    hdr: fromFilename.hdr || fromLabels.hdr,
    codec: fromFilename.codec || fromLabels.codec,
    audio: fromFilename.audio || fromLabels.audio,
    quality: fromFilename.quality || fromLabels.quality,
    language: fromFilename.language || fromLabels.language,
  };
}

function parseSizeFromText(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)\s*(GiB|GB|MiB|MB|KiB|KB)/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'GIB' || unit === 'GB') return Math.round(n * 1024 * 1024 * 1024);
  if (unit === 'MIB' || unit === 'MB') return Math.round(n * 1024 * 1024);
  if (unit === 'KIB' || unit === 'KB') return Math.round(n * 1024);
  return null;
}

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Decode a 32-char base32 infohash to lowercase hex (20 bytes).
 */
function decodeBase32Infohash(encoded) {
  const input = String(encoded || '')
    .replace(/=+$/, '')
    .toLowerCase();
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  if (bytes.length !== 20) return null;
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize torrent infohash to lowercase hex.
 * Accepts hex (40), base32 (32), or urn:btih / magnet fragments.
 */
export function normalizeInfoHash(hash) {
  if (!hash || typeof hash !== 'string') return null;
  let cleaned = hash.trim();
  if (!cleaned) return null;

  const fromUrn = cleaned.match(/urn:btih:([a-zA-Z0-9]+)/i);
  if (fromUrn) cleaned = fromUrn[1];

  const lower = cleaned.toLowerCase();
  if (/^[a-f0-9]{40}$/.test(lower)) return lower;
  if (/^[a-z2-7]{32}$/.test(lower)) return decodeBase32Infohash(lower);
  return null;
}

function extractInfoHashFromMagnetUrl(url) {
  if (typeof url !== 'string' || !url.trim().toLowerCase().startsWith('magnet:')) {
    return null;
  }
  return normalizeInfoHash(url);
}

function fingerprint(parts) {
  return parts.filter(Boolean).join('|');
}

/**
 * Streams we list in search: torrent (infoHash / magnet), usenet (nzbUrl), or http(s) url.
 * ytId / externalUrl-only / empty sources are omitted.
 * @see https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/stream.md
 */
export function isListableStream(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (normalizeInfoHash(raw.infoHash)) return true;
  if (extractInfoHashFromMagnetUrl(raw.url)) return true;
  if (typeof raw.nzbUrl === 'string' && /^https?:\/\//i.test(raw.nzbUrl.trim())) return true;
  if (typeof raw.url === 'string' && /^https?:\/\//i.test(raw.url.trim())) return true;
  return false;
}

/** @deprecated use isListableStream — kept for tests/callers */
export function isTorboxCompatibleStream(raw) {
  return isListableStream(raw);
}

/**
 * Normalize a single raw Stremio stream from one addon.
 * Returns null when there is no listable source (infoHash, nzbUrl, or http(s)/magnet url).
 */
export function normalizeStream(raw, addonMeta = {}) {
  if (!isListableStream(raw)) return null;

  const title = raw.name || raw.title || '';
  const description = raw.description || raw.title || '';
  const behaviorHints =
    raw.behaviorHints && typeof raw.behaviorHints === 'object' ? raw.behaviorHints : {};
  const filename =
    (typeof behaviorHints.filename === 'string' && behaviorHints.filename.trim()
      ? behaviorHints.filename.trim()
      : null) ||
    (typeof raw.filename === 'string' && raw.filename.trim() ? raw.filename.trim() : null);

  // Filename is the scene/P2P release name — prefer it over short UI labels like "⚡ 4K [TB]".
  const fromLabels = parseMetadata([title, description].filter(Boolean).join('\n'));
  const fromFilename = parseMetadata(filename || '');
  const parsed = mergeParsedMetadata(fromLabels, fromFilename);

  const infoHash = normalizeInfoHash(raw.infoHash) || extractInfoHashFromMagnetUrl(raw.url);
  const nzbUrl =
    typeof raw.nzbUrl === 'string' && /^https?:\/\//i.test(raw.nzbUrl.trim())
      ? raw.nzbUrl.trim()
      : null;
  const streamUrl =
    !infoHash && typeof raw.url === 'string' && /^https?:\/\//i.test(raw.url.trim())
      ? raw.url.trim()
      : null;

  let size = null;
  if (typeof behaviorHints.videoSize === 'number' && Number.isFinite(behaviorHints.videoSize)) {
    size = behaviorHints.videoSize;
  } else {
    size =
      parseSizeFromText(filename || '') ||
      parseSizeFromText([title, description].filter(Boolean).join('\n'));
  }

  const cached = behaviorHints.cached === true;

  const key = fingerprint([
    infoHash ? `ih:${infoHash}` : null,
    !infoHash && nzbUrl ? `nzb:${nzbUrl}` : null,
    !infoHash && !nzbUrl && streamUrl ? `url:${streamUrl}` : null,
  ]);

  if (!key) return null;

  return {
    key,
    addonId: addonMeta.addonId || null,
    addonName: addonMeta.addonName || null,
    addonLogo: addonMeta.addonLogo || null,
    addonSortOrder: addonMeta.sortOrder ?? 0,
    streamType: addonMeta.streamType || null,
    title: title || description || 'Stream',
    description,
    quality: parsed.quality,
    resolution: parsed.resolution,
    codec: parsed.codec,
    hdr: parsed.hdr,
    audio: parsed.audio,
    language: parsed.language,
    size,
    cached,
    filename,
    infoHash,
    nzbUrl,
    url: streamUrl,
    behaviorHints,
    raw,
    sources: [
      {
        addonId: addonMeta.addonId || null,
        addonName: addonMeta.addonName || null,
      },
    ],
  };
}

function richness(stream) {
  let score = 0;
  if (stream.infoHash) score += 4;
  if (stream.nzbUrl) score += 4;
  if (stream.url) score += 2;
  if (stream.size != null) score += 1;
  if (stream.resolution) score += 1;
  if (stream.cached) score += 1;
  return score;
}

/**
 * Merge a batch of normalized streams into an existing list (dedupe by key).
 */
export function mergeStreams(existing, incoming) {
  const map = new Map();
  for (const s of existing || []) {
    if (s?.key) map.set(s.key, s);
  }

  for (const s of incoming || []) {
    if (!s?.key) continue;
    const prev = map.get(s.key);
    if (!prev) {
      map.set(s.key, s);
      continue;
    }

    const keep = richness(s) > richness(prev) ? s : prev;
    const other = keep === s ? prev : s;
    const sources = [...(keep.sources || [])];
    for (const src of other.sources || []) {
      if (!sources.some((x) => x.addonId === src.addonId)) {
        sources.push(src);
      }
    }
    map.set(s.key, {
      ...keep,
      title: keep.title || other.title,
      description: keep.description || other.description,
      quality: keep.quality || other.quality,
      resolution: keep.resolution || other.resolution,
      codec: keep.codec || other.codec,
      hdr: keep.hdr || other.hdr,
      audio: keep.audio || other.audio,
      language: keep.language || other.language,
      size: keep.size ?? other.size,
      cached: keep.cached || other.cached,
      infoHash: keep.infoHash || other.infoHash,
      nzbUrl: keep.nzbUrl || other.nzbUrl,
      url: keep.url || other.url,
      filename: keep.filename || other.filename,
      sources,
    });
  }

  return [...map.values()];
}

function resolutionRank(resolution) {
  if (!resolution) return 0;
  return RESOLUTION_ORDER[resolution] || 0;
}

/**
 * Default sort: cached → resolution → size → addon order → title
 */
export function sortStreams(streams) {
  return [...(streams || [])].sort((a, b) => {
    if (Boolean(b.cached) !== Boolean(a.cached)) return a.cached ? -1 : 1;
    const resDiff = resolutionRank(b.resolution) - resolutionRank(a.resolution);
    if (resDiff !== 0) return resDiff;
    const sizeA = a.size ?? -1;
    const sizeB = b.size ?? -1;
    if (sizeB !== sizeA) return sizeB - sizeA;
    const orderDiff = (a.addonSortOrder ?? 0) - (b.addonSortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/**
 * Trigger a browser download (or open) for an http(s) stream URL.
 *
 * Cross-origin hosts ignore the `download` attribute, so video URLs often play
 * instead of saving. Always open in a new tab so the search page is preserved.
 * Same-origin / attachment responses may still download via `download` + filename.
 *
 * Do not fetch-as-blob or proxy: stream files are often multi-GB and addon hosts
 * rarely allow CORS.
 */
export function triggerBrowserDownload(url, filename) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return false;
  if (typeof document === 'undefined') return false;

  const a = document.createElement('a');
  a.href = url.trim();
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  if (filename) {
    a.download = filename;
  } else {
    a.download = '';
  }
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** AIOStreams Cache & Play / uncached resolve can run this long before redirecting. */
const SILENT_ADD_TIMEOUT_MS = 90_000;

/**
 * Hit an http(s) Stremio stream URL without opening a tab or triggering a download.
 *
 * TorBox-oriented addons (notably AIOStreams `/api/v1/debrid/playback/...`) add the
 * video during the request, then 302/307 to a CDN or a static "downloading" clip.
 *
 * Uses browser `fetch` + `redirect: 'manual'`:
 * - Allowed by production CSP `connect-src` (hidden iframes are blocked: `default-src 'self'`
 *   with no `frame-src`, so iframe navigations never leave the origin)
 * - Does not follow the CDN hop (avoids multi‑MB bodies from `redirect: 'follow'`)
 * - Waits long enough for AIOStreams debrid resolve (uncached titles need many seconds)
 *
 * Chromium in a page context often rejects `redirect: 'manual'` with
 * `TypeError: Failed to fetch` after a cross-origin 302 — DevTools still shows the
 * 302 and the CDN was not followed. That means the addon hop completed → success.
 *
 * @param {string} url
 * @returns {Promise<true>}
 */
export async function triggerSilentStreamAdd(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Invalid stream URL');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SILENT_ADD_TIMEOUT_MS);

  try {
    const response = await fetch(trimmed, {
      method: 'GET',
      mode: 'cors',
      // Stop before the post-add CDN hop — that body is the video.
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });

    try {
      await response.body?.cancel?.();
    } catch {
      // ignore cancel errors on opaque / already-closed bodies
    }

    if (
      response.type === 'opaqueredirect' ||
      response.status === 0 ||
      REDIRECT_STATUSES.has(response.status)
    ) {
      return true;
    }

    throw new Error(
      `Stream URL did not redirect (expected 301/302/303/307/308, got ${response.status}). Refusing to read a media body.`
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Silent add timed out waiting for the addon to resolve');
    }
    // Chromium page context: redirect:manual + cross-origin 302 → TypeError
    // ("Failed to fetch") even though the addon add hop completed.
    if (error instanceof TypeError) {
      return true;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Map a normalized stream to actions.
 * - infoHash / magnet → upload via TorBox API
 * - nzbUrl → upload via TorBox API
 * - http(s) url → copy + download + silent Add (hit URL; no TorBox API upload)
 * @returns {{ kind: 'magnet'|'usenet'|'link'|'none', canUpload: boolean, canSilentAdd: boolean, data?: string, name?: string, copyValue?: string }}
 */
export function streamToUploadTarget(stream) {
  const name = stream?.title || stream?.filename || 'Stream';

  if (stream?.infoHash) {
    const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(name)}`;
    return {
      kind: 'magnet',
      canUpload: true,
      canSilentAdd: false,
      data: magnet,
      name,
      copyValue: magnet,
    };
  }

  if (stream?.nzbUrl) {
    return {
      kind: 'usenet',
      canUpload: true,
      canSilentAdd: false,
      data: stream.nzbUrl,
      name,
      copyValue: stream.nzbUrl,
    };
  }

  if (stream?.url && /^https?:\/\//i.test(stream.url)) {
    return {
      kind: 'link',
      canUpload: false,
      canSilentAdd: true,
      data: stream.url,
      name,
      copyValue: stream.url,
    };
  }

  return { kind: 'none', canUpload: false, canSilentAdd: false, copyValue: '', name };
}
