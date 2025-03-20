import { useState, useMemo, useCallback } from 'react';
import { STATUS_OPTIONS } from '@/components/constants';

// Helper to check if torrent is queued
const isQueued = (torrent) =>
  !torrent.download_state &&
  !torrent.download_finished &&
  !torrent.active &&
  torrent.type === 'torrent';

export function useSort() {
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  // Status priority mapping (higher = higher priority)
  const statusPriorityMap = useMemo(
    () => ({
      Completed: 6,
      Downloading: 5,
      Inactive: 4,
      Queued: 3,
      Seeding: 2,
      Stalled: 1,
      Uploading: 0,
    }),
    [],
  );

  const getStatusPriority = useCallback(
    (torrent) => {
      if (isQueued(torrent)) return statusPriorityMap['Queued'];

      const status = STATUS_OPTIONS.find((option) => {
        if (option.value === 'all' || option.value.is_queued) return false;

        return Object.entries(option.value).every(([key, value]) => {
          if (key === 'download_state') {
            return (Array.isArray(value) ? value : [value]).some((state) =>
              torrent.download_state?.includes(state),
            );
          }
          return torrent[key] === value;
        });
      });

      return statusPriorityMap[status?.label] ?? -1;
    },
    [statusPriorityMap],
  );

  // Sort comparator functions
  const comparators = useMemo(
    () => ({
      numeric: (a, b, field) =>
        (Number(a[field]) || 0) - (Number(b[field]) || 0),
      text: (a, b, field) =>
        (a[field] || '')
          .toLowerCase()
          .localeCompare((b[field] || '').toLowerCase()),
      date: (a, b, field) => new Date(a[field] || 0) - new Date(b[field] || 0),
      status: (a, b) => getStatusPriority(b) - getStatusPriority(a),
      file_count: (a, b) => (a.files?.length || 0) - (b.files?.length || 0),
    }),
    [getStatusPriority],
  );

  // Field type mapping for comparator selection
  const fieldTypeMap = useMemo(
    () => ({
      id: 'numeric',
      size: 'numeric',
      total_uploaded: 'numeric',
      total_downloaded: 'numeric',
      download_speed: 'numeric',
      upload_speed: 'numeric',
      seeds: 'numeric',
      peers: 'numeric',
      eta: 'numeric',
      progress: 'numeric',
      ratio: 'numeric',
      name: 'text',
      created_at: 'date',
      cached_at: 'date',
      updated_at: 'date',
      expires_at: 'date',
      download_state: 'status',
      file_count: 'file_count',
    }),
    [],
  );

  const sortTorrents = useCallback(
    (torrents) => {
      if (!torrents?.length) return torrents;

      const comparator =
        comparators[fieldTypeMap[sortField]] || comparators.text;
      const compare =
        fieldTypeMap[sortField] === 'status'
          ? comparator
          : (a, b) => comparator(a, b, sortField);

      return [...torrents].sort((a, b) => {
        if (!a || !b) return 0;
        return sortDirection === 'desc' ? compare(b, a) : compare(a, b);
      });
    },
    [sortField, sortDirection, comparators, fieldTypeMap],
  );

  return {
    sortField,
    sortDirection,
    handleSort,
    sortTorrents,
  };
}
