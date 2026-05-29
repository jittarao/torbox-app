'use client';

import { useState, useCallback } from 'react';
import { findItemBySelectionId } from '@/utils/downloadSelectionId';

export function useBulkExport(apiKey, activeType, selectedItems, viewItems, setToast) {
  const [isExporting, setIsExporting] = useState(false);

  const handleBulkExport = useCallback(async () => {
    if (isExporting || activeType !== 'torrents') return;
    setIsExporting(true);

    try {
      const selectedItemIds = Array.from(selectedItems.items);
      if (selectedItemIds.length === 0) {
        setToast({ message: 'No items selected for export', type: 'error' });
        return;
      }

      let successCount = 0;
      let failCount = 0;

      await Promise.all(
        selectedItemIds.map(async (selectionId) => {
          const item = findItemBySelectionId(viewItems, selectionId);
          if (!item) {
            failCount += 1;
            return;
          }

          try {
            const response = await fetch(
              `/api/torrents/export?torrent_id=${item.id}&type=torrent`,
              { headers: { 'x-api-key': apiKey } }
            );

            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${item.name || item.id}.torrent`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              successCount += 1;
            } else {
              failCount += 1;
            }
          } catch {
            failCount += 1;
          }
        })
      );

      if (failCount === 0) {
        setToast({
          message: `Exported ${successCount} torrent file${successCount === 1 ? '' : 's'}`,
          type: 'success',
        });
      } else if (successCount === 0) {
        setToast({ message: 'Failed to export torrent files', type: 'error' });
      } else {
        setToast({
          message: `Exported ${successCount} of ${selectedItemIds.length} torrent files`,
          type: 'warning',
        });
      }
    } catch (error) {
      console.error('Error during bulk export:', error);
      setToast({ message: 'Failed to export torrent files', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  }, [apiKey, activeType, selectedItems, viewItems, setToast, isExporting]);

  return { isExporting, handleBulkExport };
}
