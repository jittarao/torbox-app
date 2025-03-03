import { useState, useEffect } from 'react';

const DEFAULT_MIN_WIDTH = 60;

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
        setColumnWidths(parsed);
      }
    } catch (error) {
      console.error('Error loading column widths:', error);
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
