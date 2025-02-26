export const formatSize = (bytes) => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return `${(bytesPerSecond / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString();
};

export const timeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const isFuture = diffMs < 0;

  // Get absolute difference in seconds
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const prefix = isFuture ? 'in ' : '';
  const suffix = isFuture ? '' : 'ago';

  if (years > 0) return `${prefix}${years}y ${suffix}`;
  if (months > 0) return `${prefix}${months}mo ${suffix}`;
  if (days > 0) return `${prefix}${days}d ${suffix}`;
  if (hours > 0) return `${prefix}${hours}h ${suffix}`;
  if (minutes > 0) return `${prefix}${minutes}m ${suffix}`;
  return `${prefix}${seconds}s ${suffix}`;
};

export const formatEta = (seconds) => {
  if (!seconds || seconds < 0) return 'Unknown';
  if (seconds === 0) return 'Complete';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};
