import { useState } from 'react';

export function useSort() {
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortTorrents = (torrents) => {
    return [...torrents].sort((a, b) => {
      if (!a || !b) return 0;
      let comparison = 0;
      switch (sortField) {
        // Numeric fields
        case 'id':
        case 'size':
        case 'total_uploaded':
        case 'total_downloaded':
        case 'download_speed':
        case 'upload_speed':
        case 'seeds':
        case 'peers':
        case 'eta':
          comparison = (Number(a[sortField]) || 0) - (Number(b[sortField]) || 0);
          break;
        // Progress and ratio are already numbers between 0 and 1
        case 'progress':
        case 'ratio':
          comparison = (a[sortField] || 0) - (b[sortField] || 0);
          break;
        // Text fields
        case 'name':
          comparison = (a[sortField] || '').toLowerCase().localeCompare((b[sortField] || '').toLowerCase());
          break;
        // Date fields
        case 'created_at':
        case 'updated_at':
          comparison = new Date(a[sortField] || 0) - new Date(b[sortField] || 0);
          break;
        // Other text fields
        default:
          comparison = String(a[sortField] || '').localeCompare(String(b[sortField] || ''));
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  return {
    sortField,
    sortDirection,
    handleSort,
    sortTorrents
  };
} 