/** Extensions that are audio-only; API may misreport as video (e.g. m4b as video/mp4). */
const AUDIO_EXTENSIONS = [
  '.mp3',
  '.m4b',
  '.m4a',
  '.ogg',
  '.oga',
  '.wav',
  '.flac',
  '.aac',
  '.opus',
  '.weba',
];
const AUDIO_ONLY_EXTENSIONS = AUDIO_EXTENSIONS;

/** Only .m4b and .m4a support chapter metadata; these trigger the chapters API and chapter UI. */
const CHAPTER_EXTENSIONS = ['.m4b', '.m4a'];

const AUDIO_MIMETYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/x-m4b',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/aac',
  'audio/webm',
  'audio/opus',
];

/**
 * Checks if a file is an audio file suitable for the audio player.
 * All listed extensions are playable; only .m4b/.m4a get chapter support (see hasChapterSupport).
 * @param {Object} file - File object with name/short_name and optional mimetype
 * @returns {boolean} - True if file is playable in the audio player
 */
export function isAudioFile(file) {
  if (!file) return false;
  const name = file.name || file.short_name || '';
  const lower = name.toLowerCase();
  if (AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  const mime = file.mimetype || '';
  return AUDIO_MIMETYPES.some((m) => mime.toLowerCase().startsWith(m));
}

/**
 * True only for formats that support chapter metadata (m4b, m4a). Used to decide whether to fetch chapters and show chapter UI.
 * @param {Object} file - File object with name/short_name
 * @returns {boolean}
 */
export function hasChapterSupport(file) {
  if (!file) return false;
  const name = file.name || file.short_name || '';
  const lower = name.toLowerCase();
  return CHAPTER_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Checks if a file is a video file based on mimetype and extension
 * @param {Object} file - File object with mimetype and name properties
 * @returns {boolean} - True if file is a video
 */
export function isVideoFile(file) {
  if (!file) return false;

  const fileName = file.name || file.short_name || '';
  const lowerFileName = fileName.toLowerCase();

  // Exclude audio-only extensions even when API reports video mimetype
  if (AUDIO_ONLY_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))) {
    return false;
  }

  // Check mimetype
  if (file.mimetype && file.mimetype.startsWith('video/')) {
    return true;
  }

  // Check file extension
  const videoExtensions = [
    '.mp4',
    '.mkv',
    '.avi',
    '.mov',
    '.webm',
    '.flv',
    '.wmv',
    '.m4v',
    '.mpg',
    '.mpeg',
    '.3gp',
    '.ogv',
    '.ts',
    '.m2ts',
  ];

  return videoExtensions.some((ext) => lowerFileName.endsWith(ext));
}
