'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchUserStats } from '@/utils/userStats';
import { resetBusyUnlessAborted } from '@/utils/asyncLoadingReset';

/**
 * @param {string|null|undefined} apiKey
 * @param {string} [grouping='week']
 * @returns {{ general: object|null, bandwidth: object[], loading: boolean, error: string|null, refetch: () => Promise<void> }}
 */
export function useUserStats(apiKey, grouping = 'week') {
  const [general, setGeneral] = useState(null);
  const [bandwidth, setBandwidth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchingRef = useRef(false);
  const abortRef = useRef(null);

  const refetch = useCallback(async () => {
    if (!apiKey || fetchingRef.current) return;

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUserStats(apiKey, {
        grouping,
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) return;
      setGeneral(data.general || {});
      setBandwidth(data.bandwidth || []);
    } catch (err) {
      if (abortController.signal.aborted || err.name === 'AbortError') return;
      console.error('Error fetching user stats:', err);
      setError(err.message || 'Failed to load stats');
      setGeneral(null);
      setBandwidth([]);
    } finally {
      resetBusyUnlessAborted(abortController.signal, setLoading, () => {
        fetchingRef.current = false;
      });
    }
  }, [apiKey, grouping]);

  useEffect(() => {
    if (!apiKey) {
      abortRef.current?.abort();
      setGeneral(null);
      setBandwidth([]);
      setLoading(false);
      setError(null);
      return;
    }

    refetch();

    return () => abortRef.current?.abort();
  }, [apiKey, grouping, refetch]);

  return { general, bandwidth, loading, error, refetch };
}
