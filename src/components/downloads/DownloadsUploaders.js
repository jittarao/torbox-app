'use client';

import ItemUploader from './ItemUploader';
import { hasDownloadAccess } from '@/utils/userProfile';

export default function DownloadsUploaders({ apiKey, activeType, permissions }) {
  if (activeType === 'all') {
    return (
      <div className="space-y-2">
        <ItemUploader apiKey={apiKey} activeType="torrents" />
        {hasDownloadAccess('usenet', permissions) && (
          <ItemUploader apiKey={apiKey} activeType="usenet" />
        )}
        <ItemUploader apiKey={apiKey} activeType="webdl" />
      </div>
    );
  }
  return <ItemUploader key={activeType} apiKey={apiKey} activeType={activeType} />;
}
