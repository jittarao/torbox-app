import { useState, useEffect, useCallback, useRef } from 'react';
import { parseUtcDate } from '@/utils/parseUtcDate';
import { uploadItem } from '@/utils/uploadActions';
import { buildShortMagnetLink } from '@/utils/retryDownload';
import fetch from '@/utils/fetch';
import { mergeListWithStructuralSharing } from '@/utils/listStructuralMerge';

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

function mergePaginationTotals(prev, next) {
  if (prev.total === next.total && prev.totalPages === next.totalPages) {
    return prev;
  }
  return {
    ...prev,
    total: next.total,
    totalPages: next.totalPages,
  };
}

export function useArchive(apiKey, pagination, setPagination, search = '') {
  const [archivedDownloads, setArchivedDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const effectivePageRef = useRef(pagination?.page ?? 1);
  const skipPageChangeFetchRef = useRef(false);
  const prevSearchRef = useRef(search);
  const internalPaginationRef = useRef(null);
  const requestGenerationRef = useRef(0);
  const archivedLengthRef = useRef(0);

  const apiKeyRef = useRef(apiKey);
  const searchRef = useRef(search);
  const setPaginationRef = useRef(setPagination);
  useEffect(() => {
    apiKeyRef.current = apiKey;
    searchRef.current = search;
    setPaginationRef.current = setPagination;
  }, [apiKey, search, setPagination]);

  const usesExternalPagination = Boolean(pagination && setPagination);
  const page = pagination?.page ?? 1;
  const limit = pagination?.limit ?? 50;

  const loadArchivedDownloads = useCallback(
    async (pageOverride, limitOverride, signal) => {
      const currentApiKey = apiKeyRef.current;
      if (!currentApiKey) {
        setLoading(false);
        return;
      }

      const resolvedPage = pageOverride ?? (usesExternalPagination ? effectivePageRef.current : 1);
      const resolvedLimit =
        limitOverride ??
        (usesExternalPagination ? limit : (internalPaginationRef.current?.limit ?? 50));
      const currentSearch = searchRef.current;
      const generation = ++requestGenerationRef.current;
      const showFullPageLoader = archivedLengthRef.current === 0;

      try {
        if (showFullPageLoader) {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams({
          page: String(resolvedPage),
          limit: String(resolvedLimit),
        });
        if (currentSearch) {
          params.append('search', currentSearch);
        }

        const response = await fetch(`/api/archived-downloads?${params.toString()}`, {
          headers: {
            'x-api-key': currentApiKey,
          },
          signal,
        });

        if (signal?.aborted || generation !== requestGenerationRef.current) return;

        if (!response.ok) {
          throw new Error('Failed to fetch archived downloads');
        }

        const data = await response.json();

        if (signal?.aborted || generation !== requestGenerationRef.current) return;

        if (data.success) {
          const transformed = data.data.map(transformArchivedItem);
          setArchivedDownloads((prev) =>
            mergeListWithStructuralSharing(prev, transformed, (row) => row.archiveId)
          );
          const nextPagination = data.pagination || {
            page: resolvedPage,
            limit: resolvedLimit,
            total: 0,
            totalPages: 0,
          };
          if (usesExternalPagination) {
            setPaginationRef.current((prev) =>
              mergePaginationTotals(prev, {
                total: nextPagination.total,
                totalPages: nextPagination.totalPages,
              })
            );
          } else {
            internalPaginationRef.current = nextPagination;
          }
        } else {
          throw new Error(data.error || 'Failed to fetch archived downloads');
        }
      } catch (err) {
        if (signal?.aborted || generation !== requestGenerationRef.current) return;
        if (err?.name === 'AbortError') return;
        console.error('Error fetching archived downloads:', err);
        setError(err.message);
        setArchivedDownloads((prev) => (prev.length === 0 ? prev : []));
      } finally {
        if (!signal?.aborted && generation === requestGenerationRef.current) {
          setLoading(false);
        }
      }
    },
    [limit, usesExternalPagination]
  );

  const loadArchivedRef = useRef(loadArchivedDownloads);
  useEffect(() => {
    loadArchivedRef.current = loadArchivedDownloads;
  }, [loadArchivedDownloads]);

  useEffect(() => {
    archivedLengthRef.current = archivedDownloads.length;
  }, [archivedDownloads]);

  const prevPageRef = useRef(page);
  const prevSearchForEffectRef = useRef(search);

  useEffect(() => {
    if (!usesExternalPagination) return;

    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      abortControllerRef.current?.abort();
      effectivePageRef.current = 1;
      skipPageChangeFetchRef.current = true;
      if (page !== 1) {
        setPaginationRef.current((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
      }
    } else {
      effectivePageRef.current = page;
    }
  }, [search, page, usesExternalPagination]);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    if (usesExternalPagination) {
      const pageChanged = prevPageRef.current !== page;
      const searchChanged = prevSearchForEffectRef.current !== search;
      prevPageRef.current = page;
      prevSearchForEffectRef.current = search;

      if (pageChanged && !searchChanged && skipPageChangeFetchRef.current) {
        skipPageChangeFetchRef.current = false;
        return;
      }
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    loadArchivedRef.current(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? limit : 50,
      abortController.signal
    );

    return () => abortController.abort();
  }, [apiKey, page, limit, search, usesExternalPagination]);

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
        await loadArchivedRef.current(
          usesExternalPagination ? effectivePageRef.current : 1,
          usesExternalPagination ? limit : 50
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
        await loadArchivedRef.current(
          usesExternalPagination ? effectivePageRef.current : 1,
          usesExternalPagination ? limit : 50
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
    const ids = archivedDownloads.flatMap((item) => {
      const archiveId = item.archiveId;
      return archiveId ? [archiveId] : [];
    });
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

    await loadArchivedRef.current(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? limit : 50
    );
    return [];
  };

  const restoreFromArchive = async (download) => {
    const magnetLink = buildShortMagnetLink({ hash: download.hash, name: download.name });

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
    return loadArchivedRef.current(
      usesExternalPagination ? effectivePageRef.current : 1,
      usesExternalPagination ? limit : 50
    );
  }, [limit, usesExternalPagination]);

  const fetchPage = useCallback(
    (nextPage) => {
      if (usesExternalPagination) {
        setPaginationRef.current((prev) =>
          prev.page === nextPage ? prev : { ...prev, page: nextPage }
        );
      } else {
        loadArchivedRef.current(nextPage, internalPaginationRef.current?.limit ?? 50);
      }
    },
    [usesExternalPagination]
  );

  const resolvedPagination = usesExternalPagination
    ? pagination
    : (internalPaginationRef.current ?? { page: 1, limit: 50, total: 0, totalPages: 0 });

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
