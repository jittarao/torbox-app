import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackendModeStore } from '@/store/backendModeStore';

export function useLinkHistory(apiKey, pagination, setPagination, search = '') {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevSearchRef = useRef(search);
  const abortControllerRef = useRef(null);
  // Use ref to track effective page (updated synchronously when search changes)
  const effectivePageRef = useRef(pagination.page);
  // Flag to skip fetch when page change is due to search reset
  const skipPageChangeFetchRef = useRef(false);

  // Subscribe to backend mode store to react to changes
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendModeStore();

  // Reset page to 1 when search changes (runs synchronously before fetch)
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Update effective page ref immediately (synchronous)
      effectivePageRef.current = 1;
      // Set flag to skip fetch when page state updates
      skipPageChangeFetchRef.current = true;
      // Reset page state if not already there
      if (pagination.page !== 1) {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    } else {
      // Update effective page ref when page changes (not due to search)
      effectivePageRef.current = pagination.page;
      skipPageChangeFetchRef.current = false;
    }
  }, [search, pagination.page, setPagination]);

  const fetchLinkHistory = useCallback(async () => {
    if (!apiKey) {
      setLoading(false);
      setError(null);
      return;
    }

    // Wait for backend check to complete before deciding
    if (backendIsLoading) {
      return;
    }

    // Check if backend is available
    if (backendMode !== 'backend') {
      setHistory([]);
      setLoading(false);
      setError(null);
      setPagination((prev) => ({
        ...prev,
        total: 0,
        totalPages: 0,
      }));
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError(null);

      // Use effective page from ref (always correct, even during state updates)
      const params = new URLSearchParams({
        page: effectivePageRef.current.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);

      const response = await fetch(`/api/link-history?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
        signal: abortController.signal,
      });

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch link history');
      }

      // Check again if request was aborted before updating state
      if (abortController.signal.aborted) {
        return;
      }

      setHistory(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        return;
      }
      setError(err.message);
      console.error('Error fetching link history:', err);
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [apiKey, pagination.limit, search, setPagination, backendMode, backendIsLoading]);

  // Track previous values to detect what triggered the effect
  const prevPageRef = useRef(pagination.page);
  const prevSearchForEffectRef = useRef(search);

  // Fetch when apiKey, page, limit, search, or backend mode changes
  // Skip fetch if page change is due to search reset (search change already triggered it)
  useEffect(() => {
    // Wait for backend check to complete before deciding
    if (backendIsLoading) {
      return;
    }

    const pageChanged = prevPageRef.current !== pagination.page;
    const searchChanged = prevSearchForEffectRef.current !== search;

    // Update refs for next comparison
    prevPageRef.current = pagination.page;
    prevSearchForEffectRef.current = search;

    // Skip if this is a page change (not search change) and it's due to search reset
    if (pageChanged && !searchChanged && skipPageChangeFetchRef.current) {
      skipPageChangeFetchRef.current = false;
      return;
    }

    fetchLinkHistory();
    // Auto-refresh every 1 minute (only if backend is available)
    const interval = setInterval(() => {
      // Only refresh if backend is available
      if (backendMode === 'backend' && !backendIsLoading) {
        fetchLinkHistory();
      }
    }, 60000);
    return () => {
      clearInterval(interval);
      // Cancel any in-flight request on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [
    apiKey,
    pagination.page,
    pagination.limit,
    search,
    fetchLinkHistory,
    backendMode,
    backendIsLoading,
  ]);

  return {
    history,
    setHistory,
    loading,
    error,
    fetchLinkHistory,
  };
}
