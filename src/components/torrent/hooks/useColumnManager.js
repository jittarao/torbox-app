import { useState } from 'react';
import { COLUMNS } from '../constants';

export function useColumnManager() {
  const [activeColumns, setActiveColumns] = useState(() => {
    const stored = localStorage.getItem('torboxActiveColumns');
    if (!stored) {
      return ['id', 'name', 'size', 'created_at', 'download_state'];
    }

    const storedColumns = JSON.parse(stored);
    const validColumns = storedColumns.filter(col => COLUMNS[col]);

    // If no valid columns, return defaults
    if (validColumns.length === 0) {
      return ['id', 'name', 'size', 'created_at', 'download_state'];
    }

    // Update storage with only valid columns
    localStorage.setItem('torboxActiveColumns', JSON.stringify(validColumns));
    return validColumns;
  });

  const handleColumnChange = (newColumns) => {
    const validColumns = newColumns.filter(col => COLUMNS[col]);
    setActiveColumns(validColumns);
    localStorage.setItem('torboxActiveColumns', JSON.stringify(validColumns));
  };

  return { activeColumns, handleColumnChange };
} 