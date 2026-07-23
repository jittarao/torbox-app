'use client';

import { readJsonFromResponse } from '@/utils/fetchResponse';

import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  getPlanFloorBytes,
  getUsageLevel,
  getUsagePercent,
  sumBandwidthBytes,
} from '@/utils/bandwidthUsage';

/**
 * @param {string} apiKey
 * @param {AbortSignal} signal
 */
async function fetchBandwidthUsage(apiKey, signal) {
  const params = new URLSearchParams({
    bandwidth: 'true',
    bandwidth_grouping: 'day',
  });

  const response = await fetch(`/api/user/stats?${params.toString()}`, {
    headers: { 'x-api-key': apiKey },
    signal,
  });

  return readJsonFromResponse(response);
}

/**
 * @param {string|null|undefined} apiKey
 * @param {number|null|undefined} planId
 * @param {number|null|undefined} limitBytes
 * @param {(patch: { usedBytes?: number, loading?: boolean }) => void} onUpdate
 */
function subscribeBandwidthUsage(apiKey, planId, limitBytes, onUpdate) {
  const abortController = new AbortController();

  if (!apiKey || apiKey.length < 20 || planId == null || limitBytes == null) {
    onUpdate({ usedBytes: 0, loading: false });
    return () => {
      abortController.abort();
    };
  }

  onUpdate({ loading: true });

  fetchBandwidthUsage(apiKey, abortController.signal)
    .then(({ ok: responseOk, data }) => {
      if (abortController.signal.aborted) return;

      if (!responseOk || !data.success) {
        onUpdate({ usedBytes: 0 });
        return;
      }

      onUpdate({ usedBytes: sumBandwidthBytes(data.data?.bandwidth) });
    })
    .catch(() => {
      if (!abortController.signal.aborted) {
        onUpdate({ usedBytes: 0 });
      }
    })
    .finally(() => {
      if (!abortController.signal.aborted) {
        onUpdate({ loading: false });
      }
    });

  return () => {
    abortController.abort();
  };
}

function getBandwidthUsageServerSnapshot() {
  return 'idle';
}

/**
 * @param {string|null|undefined} apiKey
 * @param {number|null|undefined} planId
 * @returns {{ level: 'warning'|'danger'|null, usedBytes: number, limitBytes: number|null, percent: number|null, loading: boolean }}
 */
export function useBandwidthUsage(apiKey, planId) {
  const limitBytes = getPlanFloorBytes(planId);
  const [fetchState, setFetchState] = useState({ usedBytes: 0, loading: true });
  const { usedBytes, loading } = fetchState;

  const canFetch = Boolean(apiKey && apiKey.length >= 20 && planId != null && limitBytes != null);
  const subscriptionKey = canFetch ? `${apiKey}:${planId}:${limitBytes}` : 'idle';

  const subscribe = useCallback(
    (onStoreChange) =>
      subscribeBandwidthUsage(apiKey, planId, limitBytes, (patch) => {
        setFetchState((prev) => {
          const next = { ...prev, ...patch };
          if (next.usedBytes === prev.usedBytes && next.loading === prev.loading) {
            return prev;
          }
          onStoreChange();
          return next;
        });
      }),
    [apiKey, planId, limitBytes]
  );

  useSyncExternalStore(subscribe, () => subscriptionKey, getBandwidthUsageServerSnapshot);

  const percent = getUsagePercent(usedBytes, planId);
  const level = loading ? null : getUsageLevel(percent);

  return { level, usedBytes, limitBytes, percent, loading };
}
