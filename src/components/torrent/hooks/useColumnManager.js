import { useState } from 'react';

export function useColumnManager() {
  const [activeColumns, setActiveColumns] = useState(() => {
    const stored = localStorage.getItem('torboxActiveColumns');
    return stored ? JSON.parse(stored) : ['id', 'name', 'size', 'created_at', 'download_state'];
  });

  const handleColumnChange = (newColumns) => {
    setActiveColumns(newColumns);
    localStorage.setItem('torboxActiveColumns', JSON.stringify(newColumns));
  };

  return { activeColumns, handleColumnChange };
} 