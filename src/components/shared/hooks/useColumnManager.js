import { useState, useEffect } from 'react';
import { COLUMNS } from '@/components/constants';

export function useColumnManager(activeType = 'torrents') {
  const [activeColumns, setActiveColumns] = useState(() => {
    // Get columns from localStorage based on asset type
    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    const stored = localStorage.getItem(storageKey);

    // Default columns for each type
    const defaultColumns = {
      torrents: ['id', 'name', 'size', 'created_at', 'download_state'],
      usenet: ['id', 'name', 'size', 'created_at', 'download_state'],
      webdl: [
        'id',
        'name',
        'size',
        'created_at',
        'download_state',
        'original_url',
      ],
    };

    if (!stored) {
      return defaultColumns[activeType] || defaultColumns.torrents;
    }

    try {
      const storedColumns = JSON.parse(stored);
      // Filter for valid columns that are applicable to this asset type
      const validColumns = storedColumns.filter((col) => {
        const column = COLUMNS[col];
        // Include column if it exists and either has no assetTypes restriction or includes the current type
        return (
          column &&
          (!column.assetTypes || column.assetTypes.includes(activeType))
        );
      });

      // If no valid columns, return defaults
      if (validColumns.length === 0) {
        return defaultColumns[activeType] || defaultColumns.torrents;
      }

      // Update storage with only valid columns
      localStorage.setItem(storageKey, JSON.stringify(validColumns));
      return validColumns;
    } catch (e) {
      // If there's an error parsing, return defaults
      return defaultColumns[activeType] || defaultColumns.torrents;
    }
  });

  // Update columns when asset type changes
  useEffect(() => {
    const storageKey = `torbox${activeType.charAt(0).toUpperCase() + activeType.slice(1)}Columns`;
    const stored = localStorage.getItem(storageKey);

    const defaultColumns = {
      torrents: ['id', 'name', 'size', 'created_at', 'download_state'],
      usenet: ['id', 'name', 'size', 'created_at', 'download_state'],
      webdl: [
        'id',
        'name',
        'size',
        'created_at',
        'download_state',
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
  }, [activeType]);

  const handleColumnChange = (newColumns) => {
    // Filter for valid columns that are applicable to this asset type
    const validColumns = newColumns.filter((col) => {
      const column = COLUMNS[col];
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
