export const isQueuedItem = (item) =>
  !item.download_state && !item.download_finished && !item.active;

export const getAutoStartOptions = () => {
  const savedOptions = localStorage.getItem('torrent-upload-options');
  return savedOptions ? JSON.parse(savedOptions) : null;
};
