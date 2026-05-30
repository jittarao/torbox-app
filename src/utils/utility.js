import { getJSON } from '@/utils/storage';

export const isQueuedItem = (item) =>
  !item.download_state && !item.download_finished && !item.active;

export const getAutoStartOptions = () => {
  return getJSON('torrent-upload-options');
};
