import { useState, useEffect } from 'react';
import {
  DEFAULT_COLUMN_WIDTHS,
  getColumnMinWidth,
} from '@/components/downloads/utils/tableColumnLayout';



export function useColumnWidths(activeType) {
  const storageKey = `${activeType}-column-widths`;
  const [columnWidths, setColumnWidths] = useState({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedWidths = localStorage.getItem(storageKey);
      if (savedWidths) {
        const parsed = JSON.parse(savedWidths);
        // Legacy saves pinned name to 240px; drop so name can flex-fill again
        if (parsed.name === 240) {
          delete parsed.name;
        }
        if (parsed.id != null && parsed.id < 72) {
          parsed.id = 88;
        }
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...parsed });
      } else {
        setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
      }
    } catch (error) {
      console.error('Error loading column widths:', error);
      setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS });
    }
  }, [storageKey]);

  const updateColumnWidth = (columnId, width) => {
    if (!isClient) return;

    const newWidth = Math.max(width, getColumnMinWidth(columnId));
    setColumnWidths((prev) => {
      const updated = { ...prev, [columnId]: newWidth };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving column widths:', error);
      }
      return updated;
    });
  };

  return { columnWidths, updateColumnWidth, isClient };
}
