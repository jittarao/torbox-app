import { useState, useEffect, useCallback } from 'react';
import { useUpload } from '../components/shared/hooks/useUpload';

export function useArchive(apiKey) {
  const { uploadItem } = useUpload(apiKey);
  const [archivedDownloads, setArchivedDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  const fetchArchivedDownloads = useCallback(async (page = 1, limit = 50) => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/archived-downloads?page=${page}&limit=${limit}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch archived downloads');
      }

      const data = await response.json();
      
      if (data.success) {
        // Transform backend data to match frontend format
        const transformed = data.data.map(item => ({
          id: item.torrent_id,
          hash: item.hash,
          tracker: item.tracker,
          name: item.name,
          archivedAt: new Date(item.archived_at).getTime(),
          archiveId: item.id, // Store the archive database ID for deletion
        }));
        
        setArchivedDownloads(transformed);
        setPagination(data.pagination || { page, limit, total: 0, totalPages: 0 });
      } else {
        throw new Error(data.error || 'Failed to fetch archived downloads');
      }
    } catch (err) {
      console.error('Error fetching archived downloads:', err);
      setError(err.message);
      setArchivedDownloads([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchArchivedDownloads();
  }, [fetchArchivedDownloads]);

  const getArchivedDownloads = () => {
    return archivedDownloads;
  };

  const archiveDownload = async (download) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    try {
      const response = await fetch('/api/archived-downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          torrent_id: download.id,
          hash: download.hash,
          tracker: download.tracker,
          name: download.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to archive download');
      }

      const data = await response.json();
      
      if (data.success) {
        // Refresh the list
        await fetchArchivedDownloads(pagination.page, pagination.limit);
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to archive download');
      }
    } catch (error) {
      console.error('Error archiving download:', error);
      throw error;
    }
  };

  const removeFromArchive = async (downloadId) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Find the archive entry to get the archive database ID
    const archiveEntry = archivedDownloads.find(item => item.id === downloadId);
    if (!archiveEntry || !archiveEntry.archiveId) {
      throw new Error('Archive entry not found');
    }

    try {
      const response = await fetch(`/api/archived-downloads/${archiveEntry.archiveId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to remove from archive');
      }

      const data = await response.json();
      
      if (data.success) {
        // Refresh the list
        await fetchArchivedDownloads(pagination.page, pagination.limit);
        return archivedDownloads.filter(item => item.id !== downloadId);
      } else {
        throw new Error(data.error || 'Failed to remove from archive');
      }
    } catch (error) {
      console.error('Error removing from archive:', error);
      throw error;
    }
  };

  const clearArchive = async () => {
    // Clear all archived downloads one by one
    // Note: We could add a bulk delete endpoint if needed
    const deletePromises = archivedDownloads.map(item => removeFromArchive(item.id));
    await Promise.all(deletePromises);
    return [];
  };

  const restoreFromArchive = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;

    try {
      const result = await uploadItem({
        type: 'magnet',
        data: magnetLink,
        name: download.name,
        seed: 3,
        allowZip: true,
        asQueued: false,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Optionally remove from archive after successful restore
      // await removeFromArchive(download.id);
    } catch (error) {
      console.error('Failed to restore from archive:', error);
      throw error;
    }
  };

  return {
    getArchivedDownloads,
    archiveDownload,
    removeFromArchive,
    clearArchive,
    restoreFromArchive,
    loading,
    error,
    pagination,
    refresh: () => fetchArchivedDownloads(pagination.page, pagination.limit),
    fetchPage: (page) => fetchArchivedDownloads(page, pagination.limit),
  };
}
