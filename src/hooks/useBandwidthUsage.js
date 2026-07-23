'use client';

import { readJsonFromResponse } from '@/utils/fetchResponse';

import { useState, useEffect } from 'react';
import {
  getPlanFloorBytes,
  getUsageLevel,
  getUsagePercent,
  sumBandwidthBytes,
} from '@/utils/bandwidthUsage';

/**
 * @param {string|null|undefined} apiKey
 * @param {number|null|undefined} planId
 * @returns {{ level: 'warning'|'danger'|null, usedBytes: number, limitBytes: number|null, percent: number|null, loading: boolean }}
 */
export function useBandwidthUsage(apiKey, planId) {
  const [usedBytes, setUsedBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const limitBytes = getPlanFloorBytes(planId);
  const percent = getUsagePercent(usedBytes, planId);
  const level = loading ? null : getUsageLevel(percent);

  useEffect(() => {
    let cancelled = false;

    if (!apiKey || apiKey.length < 20 || planId == null || limitBytes == null) {
      setUsedBytes(0);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const abortController = new AbortController();

    const fetchUsage = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          bandwidth: 'true',
          bandwidth_grouping: 'day',
        });

        const response = await fetch(`/api/user/stats?${params.toString()}`, {
          headers: { 'x-api-key': apiKey },
          signal: abortController.signal,
        });

        const { ok: responseOk, data } = await readJsonFromResponse(response);

        if (cancelled) return;

        if (!responseOk || !data.success) {
          setUsedBytes(0);
          return;
        }

        setUsedBytes(sumBandwidthBytes(data.data?.bandwidth));
      } catch {
        if (!cancelled) setUsedBytes(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsage();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [apiKey, planId, limitBytes]);

  return { level, usedBytes, limitBytes, percent, loading };
}
