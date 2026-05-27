import { useState, useEffect } from 'react';

const DEFAULT_MIN_WIDTH = 60;

/** Wider default for the name column so it is usable before the user resizes. */
export const DEFAULT_COLUMN_WIDTHS = {
  name: 240,
};

export function getColumnWidth(columnId, columnWidths) {
  return columnWidths?.[columnId] ?? DEFAULT_COLUMN_WIDTHS[columnId] ?? DEFAULT_MIN_WIDTH;
}

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

    const newWidth = Math.max(width, DEFAULT_MIN_WIDTH);
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
