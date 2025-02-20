import { useState, useMemo } from 'react';

export function useSearch(torrents) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredTorrents = useMemo(() => {
    return torrents.filter(torrent => {
      if (!torrent || typeof torrent !== 'object') return false;
      const matchesSearch = !search || (torrent.name && torrent.name.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || torrent.download_state === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [torrents, search, statusFilter]);

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filteredTorrents
  };
} 