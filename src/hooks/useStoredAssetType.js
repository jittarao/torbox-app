'use client';

import { ASSET_TYPE_IDS, ASSET_TYPE_STORAGE_KEY } from '@/components/shared/AssetTypeTabs';
import { useLocalStoragePreference } from './useLocalStoragePreference';

export default function useStoredAssetType() {
  const { value, setValue, hydrated } = useLocalStoragePreference(ASSET_TYPE_STORAGE_KEY, 'all', {
    parse: (raw) => raw,
    validate: (v) => ASSET_TYPE_IDS.includes(v),
  });

  return { activeType: value, setActiveType: setValue, hydrated };
}
