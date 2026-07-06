'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { countDownloadsPerSourceFromStore } from '@/store/downloadsDerivedSelectors';
import { formatSourceLabel } from '@/components/downloads/filters/sourceDisplay';

/**
 * Sidebar source host list derived from entity store (no viewItems prop).
 * @returns {{ entries: Array<{ host: string, label: string, count: number }> }}
 */
export function useSourceSidebarData() {
  const torboxSlice = useTorboxDownloadsStore(
    useShallow((s) => ({
      entities: s.entities,
      order: s.order,
    }))
  );

  const entries = useMemo(() => {
    const counts = countDownloadsPerSourceFromStore(torboxSlice);
    return Object.entries(counts)
      .map(([host, count]) => ({
        host,
        label: formatSourceLabel(host),
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  }, [torboxSlice]);

  return { entries };
}
