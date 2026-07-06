'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { countDownloadsPerTrackerFromStore } from '@/store/downloadsDerivedSelectors';
import { formatTrackerLabel } from '@/components/downloads/filters/trackerDisplay';

/**
 * Sidebar tracker list derived from entity store (no viewItems prop).
 * @returns {{ entries: Array<{ url: string, label: string, count: number }> }}
 */
export function useTrackerSidebarData() {
  const torboxSlice = useTorboxDownloadsStore(
    useShallow((s) => ({
      entities: s.entities,
      order: s.order,
    }))
  );

  const entries = useMemo(() => {
    const counts = countDownloadsPerTrackerFromStore(torboxSlice);
    return Object.entries(counts)
      .map(([url, count]) => ({
        url,
        label: formatTrackerLabel(url),
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  }, [torboxSlice]);

  return { entries };
}
