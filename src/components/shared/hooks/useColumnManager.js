import { useState, useEffect, useRef } from 'react';
import { COLUMNS } from '@/components/constants';
import { getJSON, setJSON } from '@/utils/storage';

function getDefaultColumns(activeType) {
  const defaults = {
    all: ['id', 'name', 'size', 'created_at', 'download_state', 'asset_type', 'download_progress'],
    torrents: ['id', 'name', 'size', 'created_at', 'download_state', 'download_progress'],
    usenet: ['id', 'name', 'size', 'created_at', 'download_state', 'download_progress'],
    webdl: [
      'id',
      'name',
      'size',
      'created_at',
      'download_state',
      'download_progress',
      'original_url',
    ],
  };
  return defaults[activeType] || defaults.torrents;
}

function loadColumns(activeType) {
  if (typeof window === 'undefined') return getDefaultColumns(activeType);

  const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
  const storedColumns = getJSON(storageKey);
  if (!storedColumns) return getDefaultColumns(activeType);

  try {
    const validColumns = storedColumns.filter((col) => {
      const column = COLUMNS[col];
      if (activeType === 'all') {
        return (
          column &&
          (!column.assetTypes ||
            column.assetTypes.includes('all') ||
            column.assetTypes.includes(activeType))
        );
      }
      return column && (!column.assetTypes || column.assetTypes.includes(activeType));
    });

    if (validColumns.length === 0) return getDefaultColumns(activeType);
    setJSON(storageKey, validColumns);
    return validColumns;
  } catch (e) {
    return getDefaultColumns(activeType);
  }
}

export function useColumnManager(activeType = 'torrents') {
  const [activeColumns, setActiveColumns] = useState(() => loadColumns(activeType));
  const prevTypeRef = useRef(activeType);

  if (prevTypeRef.current !== activeType) {
    prevTypeRef.current = activeType;
    setActiveColumns(loadColumns(activeType));
  }

  const handleColumnChange = (newColumns) => {
    if (typeof window === 'undefined') return;

    // Filter for valid columns that are applicable to this asset type
    const validColumns = newColumns.filter((col) => {
      const column = COLUMNS[col];
      // For "all" tab, include columns that are either universal or specifically allowed for "all"
      if (activeType === 'all') {
        return (
          column &&
          (!column.assetTypes ||
            column.assetTypes.includes('all') ||
            column.assetTypes.includes(activeType))
        );
      }
      return column && (!column.assetTypes || column.assetTypes.includes(activeType));
    });

    setActiveColumns(validColumns);

    // Store in localStorage with asset type-specific key
    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    setJSON(storageKey, validColumns);
  };

  return { activeColumns, handleColumnChange };
}
