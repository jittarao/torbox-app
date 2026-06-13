import { getJSON } from '@/utils/storage';

/** Whether a download row is in the TorBox queue (matches backend torrentStatus.js). */
export const isQueuedItem = (item) => {
  if (!item) return false;

  if (item.status && String(item.status).toLowerCase() === 'queued') return true;
  return false;
};

/** API may return active as boolean, 1, or the string "true". */
export const isActiveDownload = (item) => {
  const value = item?.active;
  return value === true || value === 1 || value === 'true';
};

export const getAutoStartOptions = () => {
  return getJSON('torrent-upload-options');
};
