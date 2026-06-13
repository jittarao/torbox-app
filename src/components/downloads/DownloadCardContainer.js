'use client';

import { memo, useMemo } from 'react';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { enrichRowForFilter } from '@/store/downloadsDerivedSelectors';
import ItemCard from './ItemCard';

/**
 * Subscribes to a single download entity — keeps card view in sync with polls (like table rows).
 */
function DownloadCardContainer({ entityKey, tagMappings, downloadHistoryLookup, ...cardProps }) {
  const entity = useTorboxDownloadsStore((state) => state.entities[entityKey]);
  const item = useMemo(() => {
    if (!entity) return null;
    return enrichRowForFilter(entity, tagMappings, downloadHistoryLookup);
  }, [entity, tagMappings, downloadHistoryLookup]);

  if (!item) return null;

  return <ItemCard item={item} downloadHistoryLookup={downloadHistoryLookup} {...cardProps} />;
}

export default memo(DownloadCardContainer);
