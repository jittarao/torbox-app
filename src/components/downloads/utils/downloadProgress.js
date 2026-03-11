/**
 * Compute progress and sizes for a download item (torrent, usenet, webdl).
 * Shared by DownloadProgressDisplay and any caller that needs raw progress data.
 *
 * @param {Object} item - Download item with active, progress, size, total_downloaded, assetType, etc.
 * @returns {{ progress: number, downloadedSize: number, totalSize: number, downloadSpeed: number, etaSeconds: number, isActive: boolean }}
 */
export function getDownloadProgress(item) {
  const totalSize = item.size || 0;
  const downloadSpeed = item.download_speed || 0;
  const isActive = Boolean(item.active && !item.download_finished);

  let progress = 0;
  let downloadedSize = 0;

  if (item.assetType === 'usenet' || item.assetType === 'webdl') {
    progress = (item.progress || 0) * 100;
    downloadedSize = totalSize * (item.progress || 0);
  } else {
    downloadedSize = item.total_downloaded || 0;
    if (totalSize > 0 && downloadedSize > 0) {
      progress = (downloadedSize / totalSize) * 100;
    } else if (item.progress !== undefined) {
      progress = (item.progress || 0) * 100;
      downloadedSize = totalSize * (item.progress || 0);
    }
  }

  const remainingSize = totalSize - downloadedSize;
  const etaSeconds = downloadSpeed > 0 ? remainingSize / downloadSpeed : 0;

  return {
    progress,
    downloadedSize,
    totalSize,
    downloadSpeed,
    etaSeconds,
    isActive,
  };
}
