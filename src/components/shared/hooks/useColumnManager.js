import { useState, useEffect } from 'react';
import { COLUMNS } from '@/components/constants';

export function useColumnManager(activeType = 'torrents') {
  const [isClient, setIsClient] = useState(false);
  const [activeColumns, setActiveColumns] = useState(() => {
    // Default columns for each type - used for initial server-side rendering
    const defaultColumns = {
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

    // Return default columns for server-side rendering
    return defaultColumns[activeType] || defaultColumns.torrents;
  });

  // Initialize columns from localStorage after component is mounted
  useEffect(() => {
    setIsClient(true);

    // Get columns from localStorage based on asset type
    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    const stored =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

    // Default columns for each type
    const defaultColumns = {
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

    if (!stored) {
      setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
      return;
    }

    try {
      const storedColumns = JSON.parse(stored);
      // Filter for valid columns that are applicable to this asset type
      const validColumns = storedColumns.filter((col) => {
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
        // For specific tabs, include column if it exists and either has no assetTypes restriction or includes the current type
        return (
          column &&
          (!column.assetTypes || column.assetTypes.includes(activeType))
        );
      });

      // If no valid columns, return defaults
      if (validColumns.length === 0) {
        setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
        return;
      }

      // Update storage with only valid columns
      localStorage.setItem(storageKey, JSON.stringify(validColumns));
      setActiveColumns(validColumns);
    } catch (e) {
      // If there's an error parsing, return defaults
      setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
    }
  }, [activeType]);

  // Update columns when asset type changes
  useEffect(() => {
    if (!isClient) return;

    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    const stored = localStorage.getItem(storageKey);

    const defaultColumns = {
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

    if (!stored) {
      setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
      return;
    }

    try {
      const storedColumns = JSON.parse(stored);
      // Filter for valid columns that are applicable to this asset type
      const validColumns = storedColumns.filter((col) => {
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
        return (
          column &&
          (!column.assetTypes || column.assetTypes.includes(activeType))
        );
      });

      // If no valid columns, use defaults
      if (validColumns.length === 0) {
        setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
      } else {
        setActiveColumns(validColumns);
      }
    } catch (e) {
      // If there's an error parsing, use defaults
      setActiveColumns(defaultColumns[activeType] || defaultColumns.torrents);
    }
  }, [activeType, isClient]);

  const handleColumnChange = (newColumns) => {
    if (!isClient) return;

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
      return (
        column && (!column.assetTypes || column.assetTypes.includes(activeType))
      );
    });

    setActiveColumns(validColumns);

    // Store in localStorage with asset type-specific key
    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    localStorage.setItem(storageKey, JSON.stringify(validColumns));
  };

  return { activeColumns, handleColumnChange };
}
