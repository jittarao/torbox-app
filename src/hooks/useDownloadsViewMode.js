'use client';

import { useLocalStoragePreference } from './useLocalStoragePreference';

const STORAGE_KEY = 'downloads-view-mode';
const VALID_MODES = new Set(['table', 'card']);

export default function useDownloadsViewMode() {
  const { value, setValue, hydrated } = useLocalStoragePreference(STORAGE_KEY, 'table', {
    parse: (raw) => raw,
    validate: (v) => VALID_MODES.has(v),
  });

  return { viewMode: value, setViewMode: setValue, hydrated };
}
