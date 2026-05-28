'use client';

import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';

/**
 * Keeps virtual row state in sync without flushSync during scroll / layout transitions.
 * Shared by table and card virtualized lists.
 */
export function useDownloadsVirtualRowSync({
  virtualizer,
  viewMode,
  isFullscreen,
  fullscreenScrollEl,
  rowCount,
  remeasureDeps = [],
}) {
  const [virtualRows, setVirtualRows] = useState([]);
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  const prevViewModeRef = useRef(viewMode);
  const prevIsFullscreenRef = useRef(isFullscreen);
  const isTransitioningRef = useRef(false);

  const syncVirtualRows = useCallback(() => {
    try {
      const rows = virtualizerRef.current.getVirtualItems();
      setVirtualRows((previousRows) => {
        if (
          previousRows.length === rows.length &&
          previousRows.every(
            (row, index) =>
              row.index === rows[index]?.index &&
              row.start === rows[index]?.start &&
              row.size === rows[index]?.size
          )
        ) {
          return previousRows;
        }
        return rows;
      });
    } catch {
      // retry on next sync
    }
  }, []);

  const remeasureAndSync = useCallback(() => {
    try {
      virtualizerRef.current.measure?.();
    } catch {
      // ignore
    }
    syncVirtualRows();
  }, [syncVirtualRows]);

  useLayoutEffect(() => {
    const viewModeChanged = prevViewModeRef.current !== viewMode;
    const fullscreenChanged = prevIsFullscreenRef.current !== isFullscreen;
    prevViewModeRef.current = viewMode;
    prevIsFullscreenRef.current = isFullscreen;

    if (viewModeChanged || fullscreenChanged) {
      isTransitioningRef.current = true;
      setVirtualRows([]);
    }

    const rafId = requestAnimationFrame(() => {
      remeasureAndSync();
      isTransitioningRef.current = false;
    });
    return () => cancelAnimationFrame(rafId);
  }, [viewMode, rowCount, isFullscreen, fullscreenScrollEl, remeasureAndSync]);

  useLayoutEffect(() => {
    remeasureAndSync();
  }, [...remeasureDeps, remeasureAndSync]);

  useEffect(() => {
    const scrollTarget = isFullscreen ? fullscreenScrollEl : window;
    if (!scrollTarget) return;

    let rafId = null;
    const scheduleSync = () => {
      if (isTransitioningRef.current || rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncVirtualRows();
      });
    };

    scheduleSync();
    scrollTarget.addEventListener('scroll', scheduleSync, { passive: true });
    window.addEventListener('resize', scheduleSync);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
    };
  }, [isFullscreen, fullscreenScrollEl, rowCount, syncVirtualRows]);

  useEffect(() => {
    if (!isFullscreen || !fullscreenScrollEl) return;
    const observer = new ResizeObserver(() => remeasureAndSync());
    observer.observe(fullscreenScrollEl);
    return () => observer.disconnect();
  }, [isFullscreen, fullscreenScrollEl, remeasureAndSync]);

  return { virtualRows, remeasureAndSync, syncVirtualRows };
}
