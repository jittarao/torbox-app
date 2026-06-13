import { AUDIO_STORAGE_KEY, SPEED_OPTIONS } from './constants';
import { getJSON, setJSON } from '@/utils/storage';

function getFileKey(itemId, fileId) {
  return `${itemId}-${fileId}`;
}

function getStorage() {
  const data = getJSON(AUDIO_STORAGE_KEY);
  if (!data) return { volume: 1, byFile: {} };
  return {
    volume:
      typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 1 ? data.volume : 1,
    byFile: data.byFile && typeof data.byFile === 'object' ? data.byFile : {},
  };
}

function setStorage(data) {
  setJSON(AUDIO_STORAGE_KEY, data);
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
