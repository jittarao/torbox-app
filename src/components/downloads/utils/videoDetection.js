/**
 * Checks if a file is a video file based on mimetype and extension
 * @param {Object} file - File object with mimetype and name properties
 * @returns {boolean} - True if file is a video
 */
export function isVideoFile(file) {
  if (!file) return false;

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

  const fileName = file.name || file.short_name || '';
  const lowerFileName = fileName.toLowerCase();
  
  return videoExtensions.some((ext) => lowerFileName.endsWith(ext));
}
