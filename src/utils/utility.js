import { sortItemsNonMutating } from '@/utils/downloadListMerge';

export const isQueuedItem = (item) =>
  !item.download_state && !item.download_finished && !item.active;

export const getAutoStartOptions = () => {
  const savedOptions = localStorage.getItem('torrent-upload-options');
  return savedOptions ? JSON.parse(savedOptions) : null;
};

/** @deprecated Prefer sortItemsNonMutating — this wrapper avoids mutating the input array. */
export const sortItems = (items) => sortItemsNonMutating(items ?? []);
