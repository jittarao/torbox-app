import { useState, useEffect, useCallback, useRef } from 'react';
import { parseUtcDate } from '@/utils/parseUtcDate';
import { uploadItem } from '@/utils/uploadActions';

function transformArchivedItem(item) {
  return {
    id: item.torrent_id,
    hash: item.hash,
    tracker: item.tracker,
    name: item.name,
    archivedAt: parseUtcDate(item.archived_at).getTime(),
    archiveId: item.id,
  };
}

export function useArchive(apiKey, pagination, setPagination, search = '') {
  const [archivedDownloads, setArchivedDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevSearchRef = useRef(search);
  const abortControllerRef = useRef(null);
  const effectivePageRef = useRef(pagination?.page ?? 1);
  const skipPageChangeFetchRef = useRef(false);

  const internalPaginationRef = useRef(null);
  const usesExternalPagination = Boolean(pagination && setPagination);

  useEffect(() => {
    if (!usesExternalPagination) return;

    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      effectivePageRef.current = 1;
      skipPageChangeFetchRef.current = true;
      if (pagination.page !== 1) {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    } else {
      effectivePageRef.current = pagination.page;
      skipPageChangeFetchRef.current = false;
    }
  }, [search, pagination, setPagination, usesExternalPagination]);

  const fetchArchivedDownloads = useCallback(
    async (page, limit, signal) => {
      if (!apiKey) {
        setLoading(false);
        return;
      }

      const resolvedPage = page ?? (usesExternalPagination ? effectivePageRef.current : 1);
      const resolvedLimit =
        limit ?? (usesExternalPagination ? pagination.limit : internalPaginationRef.current?.limit ?? 50);

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: String(resolvedPage),
          limit: String(resolvedLimit),
        });
        if (search) {
          params.append('search', search);
        }

        const response = await fetch(`/api/archived-downloads?${params.toString()}`, {
          headers: {
            'x-api-key': apiKey,
          },
          signal,
        });

        if (signal?.aborted) return;

        if (!response.ok) {
          throw new Error('Failed to fetch archived downloads');
        }

        const data = await response.json();

        if (signal?.aborted) return;

        if (data.success) {
          const transformed = data.data.map(transformArchivedItem);
          setArchivedDownloads(transformed);
          const nextPagination = data.pagination || {
            page: resolvedPage,
            limit: resolvedLimit,
            total: 0,
            totalPages: 0,
          };
          if (usesExternalPagination) {
            setPagination((prev) => ({
              ...prev,
              page: nextPagination.page,
              limit: nextPagination.limit,
              total: nextPagination.total,
              totalPages: nextPagination.totalPages,
            }));
          } else {
            internalPaginationRef.current = nextPagination;
          }
        } else {
          throw new Error(data.error || 'Failed to fetch archived downloads');
        }
      } catch (err) {
        if (signal?.aborted) return;
        console.error('Error fetching archived downloads:', err);
        setError(err.message);
        setArchivedDownloads([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [apiKey, pagination, search, setPagination, usesExternalPagination]
  );

  const prevPageRef = useRef(pagination?.page ?? 1);
  const prevSearchForEffectRef = useRef(search);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    if (usesExternalPagination) {
      const pageChanged = prevPageRef.current !== pagination.page;
      const searchChanged = prevSearchForEffectRef.current !== search;
      prevPageRef.current = pagination.page;
      prevSearchForEffectRef.current = search;

      if (pageChanged && !searchChanged && skipPageChangeFetchRef.current) {
        skipPageChangeFetchRef.current = false;
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    fetchArchivedDownloads(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? pagination.limit : 50,
      abortController.signal
    );

    return () => abortController.abort();
  }, [
    apiKey,
    fetchArchivedDownloads,
    usesExternalPagination,
    pagination?.page,
    pagination?.limit,
    search,
  ]);

  const getArchivedDownloads = () => archivedDownloads;

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
        await fetchArchivedDownloads(
          usesExternalPagination ? effectivePageRef.current : 1,
          usesExternalPagination ? pagination.limit : 50
        );
        return data.data;
      }
      throw new Error(data.error || 'Failed to archive download');
    } catch (err) {
      console.error('Error archiving download:', err);
      throw err;
    }
  };

  const removeFromArchive = async (downloadId) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const archiveEntry = archivedDownloads.find((item) => item.id === downloadId);
    if (!archiveEntry?.archiveId) {
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
        await fetchArchivedDownloads(
          usesExternalPagination ? effectivePageRef.current : 1,
          usesExternalPagination ? pagination.limit : 50
        );
        return archivedDownloads.filter((item) => item.id !== downloadId);
      }
      throw new Error(data.error || 'Failed to remove from archive');
    } catch (err) {
      console.error('Error removing from archive:', err);
      throw err;
    }
  };

  const clearArchive = async () => {
    const ids = archivedDownloads.map((item) => item.archiveId).filter(Boolean);
    if (ids.length === 0) return [];

    const response = await fetch('/api/archived-downloads/bulk', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ids }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to clear archive');
    }

    await fetchArchivedDownloads(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? pagination.limit : 50
    );
    return [];
  };

  const restoreFromArchive = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;

    try {
      const result = await uploadItem(apiKey, {
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
    } catch (err) {
      console.error('Failed to restore from archive:', err);
      throw err;
    }
  };

  const refresh = useCallback(() => {
    return fetchArchivedDownloads(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? pagination.limit : 50
    );
  }, [fetchArchivedDownloads, usesExternalPagination, pagination?.limit]);

  const fetchPage = useCallback(
    (page) => {
      if (usesExternalPagination) {
        setPagination((prev) => ({ ...prev, page }));
      } else {
        fetchArchivedDownloads(page, internalPaginationRef.current?.limit ?? 50);
      }
    },
    [fetchArchivedDownloads, setPagination, usesExternalPagination]
  );

  const resolvedPagination = usesExternalPagination
    ? pagination
    : internalPaginationRef.current ?? { page: 1, limit: 50, total: 0, totalPages: 0 };

  return {
    getArchivedDownloads,
    archiveDownload,
    removeFromArchive,
    clearArchive,
    restoreFromArchive,
    loading,
    error,
    pagination: resolvedPagination,
    refresh,
    fetchPage,
    fetchArchivedDownloads: refresh,
  };
}
