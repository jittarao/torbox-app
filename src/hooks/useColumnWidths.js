import { useState } from 'react';
import {
  DEFAULT_COLUMN_WIDTHS,
  getColumnMinWidth,
} from '@/components/downloads/utils/tableColumnLayout';

function loadColumnWidths(storageKey) {
  if (typeof window === 'undefined') return { ...DEFAULT_COLUMN_WIDTHS };
  try {
    const savedWidths = localStorage.getItem(storageKey);
    if (savedWidths) {
      const parsed = JSON.parse(savedWidths);
      if (parsed.name === 240) {
        delete parsed.name;
      }
      if (parsed.id != null && parsed.id < 72) {
        parsed.id = 88;
      }
      return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
    }
    return { ...DEFAULT_COLUMN_WIDTHS };
  } catch (error) {
    console.error('Error loading column widths:', error);
    return { ...DEFAULT_COLUMN_WIDTHS };
  }
}

export function useColumnWidths(activeType) {
  const storageKey = `${activeType}-column-widths`;
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths(storageKey));

  const updateColumnWidth = (columnId, width) => {
    if (typeof window === 'undefined') return;

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

  return { columnWidths, updateColumnWidth };
}
