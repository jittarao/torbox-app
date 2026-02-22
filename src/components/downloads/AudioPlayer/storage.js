import { AUDIO_STORAGE_KEY, SPEED_OPTIONS } from './constants';

function getFileKey(itemId, fileId) {
  return `${itemId}-${fileId}`;
}

function getStorage() {
  if (typeof window === 'undefined') return { volume: 1, byFile: {} };
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (!raw) return { volume: 1, byFile: {} };
    const data = JSON.parse(raw);
    return {
      volume: typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 1 ? data.volume : 1,
      byFile: data.byFile && typeof data.byFile === 'object' ? data.byFile : {},
    };
  } catch {
    return { volume: 1, byFile: {} };
  }
}

function setStorage(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function loadPosition(itemId, fileId) {
  const data = getStorage();
  const file = data.byFile[getFileKey(itemId, fileId)];
  const n = file != null && typeof file.position === 'number' ? file.position : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function savePosition(itemId, fileId, seconds) {
  const data = getStorage();
  const key = getFileKey(itemId, fileId);
  data.byFile[key] = { ...data.byFile[key], position: seconds };
  setStorage(data);
}

export function loadSpeed(itemId, fileId) {
  const data = getStorage();
  const file = data.byFile[getFileKey(itemId, fileId)];
  const n = file != null && typeof file.speed === 'number' ? file.speed : NaN;
  return SPEED_OPTIONS.includes(n) ? n : 1;
}

export function saveSpeed(itemId, fileId, speed) {
  const data = getStorage();
  const key = getFileKey(itemId, fileId);
  data.byFile[key] = { ...data.byFile[key], speed };
  setStorage(data);
}

export function loadVolume() {
  return getStorage().volume;
}

export function saveVolume(vol) {
  const data = getStorage();
  data.volume = vol;
  setStorage(data);
}
