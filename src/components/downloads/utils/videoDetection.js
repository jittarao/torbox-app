/**
 * Extensions that are audio-only; API may misreport as video (e.g. m4b as video/mp4).
 * These must not be treated as video for the Play button.
 */
const AUDIO_ONLY_EXTENSIONS = ['.m4b', '.m4a'];

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
