'use client';

import { memo, useMemo } from 'react';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { enrichRowForFilter } from '@/store/downloadsDerivedSelectors';
import ItemRow from './ItemRow';

/**
 * Subscribes to a single download entity by composite key — limits re-renders on poll.
 */
function DownloadRowContainer({ entityKey, tagMappings, downloadHistoryLookup, ...rowProps }) {
  const entity = useTorboxDownloadsStore((state) => state.entities[entityKey]);
  const item = useMemo(() => {
    if (!entity) return null;
    return enrichRowForFilter(entity, tagMappings, downloadHistoryLookup);
  }, [entity, tagMappings, downloadHistoryLookup]);

  if (!item) return null;
  return (
    <ItemRow
      item={item}
      entityKey={entityKey}
      downloadHistoryLookup={downloadHistoryLookup}
      {...rowProps}
    />
  );
}

export default memo(DownloadRowContainer);
