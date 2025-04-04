import { createTranslator } from 'next-intl';

export const formatSize = (bytes, locale = 'en') => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(bytes / Math.pow(1024, i)) +
    ' ' +
    sizes[i]
  );
};

export const formatSpeed = (bytesPerSecond, locale = 'en') => {
  // Handle all edge cases: null, undefined, NaN, 0, negative values
  if (
    bytesPerSecond === null ||
    bytesPerSecond === undefined ||
    isNaN(bytesPerSecond) ||
    bytesPerSecond <= 0
  ) {
    return '0 B/s';
  }

  try {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));

    // Ensure i is within valid range for the units array
    if (i < 0 || i >= units.length) {
      return '0 B/s';
    }

    // Calculate the value in the appropriate unit
    const value = bytesPerSecond / Math.pow(1024, i);

    // Round to nearest integer for cleaner display
    const roundedValue = Math.round(value);

    return (
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
      }).format(roundedValue) +
      ' ' +
      units[i]
    );
  } catch (error) {
    // Fallback in case of any calculation errors
    return '0 B/s';
  }
};

export const formatDate = (dateString, locale = 'en') => {
  return new Date(dateString).toLocaleString(locale);
};

export const timeAgo = (dateString, t) => {
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

  const prefix = isFuture ? t('time.in') : '';
  const suffix = isFuture ? '' : t('time.ago');

  if (years > 0) return `${prefix}${years}${t('time.y')} ${suffix}`;
  if (months > 0) return `${prefix}${months}${t('time.mo')} ${suffix}`;
  if (days > 0) return `${prefix}${days}${t('time.d')} ${suffix}`;
  if (hours > 0) return `${prefix}${hours}${t('time.h')} ${suffix}`;
  if (minutes > 0) return `${prefix}${minutes}${t('time.m')} ${suffix}`;
  return `${prefix}${seconds}${t('time.s')} ${suffix}`;
};

export const formatEta = (seconds, t) => {
  if (!seconds || seconds < 0) return t('time.unknown');
  if (seconds === 0) return t('time.complete');

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}${t('time.h')} ${minutes}${t('time.m')}`;
  if (minutes > 0)
    return `${minutes}${t('time.m')} ${remainingSeconds}${t('time.s')}`;
  return `${remainingSeconds}${t('time.s')}`;
};
