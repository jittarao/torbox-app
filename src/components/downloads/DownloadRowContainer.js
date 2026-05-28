'use client';

import { memo } from 'react';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import ItemRow from './ItemRow';

/**
 * Subscribes to a single download entity by composite key — limits re-renders on poll.
 */
function DownloadRowContainer({ entityKey, ...rowProps }) {
  const item = useTorboxDownloadsStore((state) => state.entities[entityKey]);
  if (!item) return null;
  return <ItemRow item={item} entityKey={entityKey} {...rowProps} />;
}

export default memo(DownloadRowContainer);
