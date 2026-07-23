import { useState, useRef, useEffect } from 'react';
import {
  DEFAULT_COLUMN_WIDTHS,
  getColumnMinWidth,
} from '@/components/downloads/utils/tableColumnLayout';
import { getJSON, setJSON } from '@/utils/storage';

const SAVE_DEBOUNCE_MS = 500;

function loadColumnWidths(storageKey) {
  const parsed = getJSON(storageKey);
  if (!parsed) return { ...DEFAULT_COLUMN_WIDTHS };
  if (parsed.name === 240) {
    delete parsed.name;
  }
  if (parsed.id != null && parsed.id < 72) {
    parsed.id = 88;
  }
  return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
}

export function useColumnWidths(activeType) {
  const storageKey = `${activeType}-column-widths`;
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths(storageKey));
  const saveTimerRef = useRef(null);
  const pendingWidthsRef = useRef(null);

  useEffect(() => {
    setColumnWidths(loadColumnWidths(storageKey));
  }, [storageKey]);

  useEffect(() => {
    pendingWidthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingWidthsRef.current) {
        setJSON(storageKey, pendingWidthsRef.current);
      }
    };
  }, [storageKey]);

  const updateColumnWidth = (columnId, width) => {
    if (typeof window === 'undefined') return;

    const newWidth = Math.max(width, getColumnMinWidth(columnId));
    // Chain through the ref so rapid resize events in one tick keep every
    // column change, without side effects inside the state updater.
    const updated = {
      ...(pendingWidthsRef.current ?? columnWidths),
      [columnId]: newWidth,
    };
    pendingWidthsRef.current = updated;
    setColumnWidths(updated);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      setJSON(storageKey, pendingWidthsRef.current);
    }, SAVE_DEBOUNCE_MS);
  };

  return { columnWidths, updateColumnWidth };
}
