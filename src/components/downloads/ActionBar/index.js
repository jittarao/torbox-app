'use client';

import { useState, useRef, useEffect, Fragment, useCallback } from 'react';
import { getItemTypeName } from './utils/statusHelpers';
import ActionBarSearch from './components/ActionBarSearch';
import ActionBarStatus from './components/ActionBarStatus';
import ActionBarBulk from './components/ActionBarBulk';
import ActionBarControls from './components/ActionBarControls';
import { useLayoutOnTabVisible } from '../hooks/useLayoutOnTabVisible';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';

export default function ActionBar() {
  const {
    activeType = 'torrents',
    isFullscreen = false,
    displayViewMode: viewMode = 'table',
    scrollContainerRef,
    filtersSidebarExpanded: hasFiltersSidebar = false,
  } = useDownloadsUIContext();

  const [isSticky, setIsSticky] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);
  const [stickyBounds, setStickyBounds] = useState(null);
  const stickyRef = useRef(null);
  const isStickyRef = useRef(false);
  const refreshStickyLayoutRef = useRef(() => {});

  const itemTypeName = getItemTypeName(activeType);
  const itemTypePlural = `${itemTypeName}s`;

  useEffect(() => {
    const element = stickyRef.current;
    if (!element) return;

    setIsSticky(false);
    isStickyRef.current = false;

    const measureHeight = () => {
      if (element) {
        const height = element.offsetHeight;
        setSpacerHeight((prev) => (prev !== height ? height : prev));
      }
    };

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measureHeight, 100);
    };

    const updateBounds = () => {
      const column = scrollContainerRef?.current;
      if (!column || !isStickyRef.current || isFullscreen) {
        setStickyBounds(null);
        return;
      }
      const rect = column.getBoundingClientRect();
      setStickyBounds({ left: rect.left, width: rect.width });
    };

    const parent = element.parentElement;
    if (!parent) return;

    const sentinel = document.createElement('div');
    sentinel.style.position = 'absolute';
    sentinel.style.top = '0';
    sentinel.style.width = '1px';
    sentinel.style.height = '1px';
    sentinel.style.pointerEvents = 'none';
    parent.insertBefore(sentinel, element);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldBeSticky = !entry.isIntersecting;
        if (shouldBeSticky !== isStickyRef.current) {
          isStickyRef.current = shouldBeSticky;
          setIsSticky(shouldBeSticky);
          if (shouldBeSticky) {
            measureHeight();
          }
        }
        if (shouldBeSticky && !isFullscreen) {
          updateBounds();
        }
      },
      { threshold: [0], rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(sentinel);

    refreshStickyLayoutRef.current = () => {
      measureHeight();
      updateBounds();
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    };

    measureHeight();
    window.addEventListener('resize', handleResize);

    const column = scrollContainerRef?.current;
    const resizeObserver =
      column && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateBounds())
        : null;
    resizeObserver?.observe(column);

    return () => {
      observer.disconnect();
      refreshStickyLayoutRef.current = () => {};
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
      sentinel.remove();
    };
  }, [isFullscreen, scrollContainerRef, viewMode]);

  const handleTabVisible = useCallback(() => {
    if (!stickyRef.current) return;
    refreshStickyLayoutRef.current();
  }, []);

  useLayoutOnTabVisible(handleTabVisible);

  return (
    <Fragment>
      {isSticky && spacerHeight > 0 && <div style={{ height: `${spacerHeight}px` }} />}
      <div
        ref={stickyRef}
        className={
          isSticky
            ? `fixed top-0 z-50 border-b border-border dark:border-border-dark shadow-lg bg-surface dark:bg-surface-dark ${
                isFullscreen
                  ? 'left-0 right-0'
                  : stickyBounds
                    ? ''
                    : hasFiltersSidebar
                      ? 'left-0 right-0 md:left-[var(--downloads-content-left)]'
                      : 'left-0 right-0 md:left-[var(--sidebar-width,0px)]'
              }`
            : undefined
        }
        style={
          isSticky && !isFullscreen && stickyBounds
            ? { left: stickyBounds.left, width: stickyBounds.width, right: 'auto' }
            : undefined
        }
      >
        <div
          className={`flex flex-col gap-y-2 transition-all duration-200 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-3 xl:gap-y-2
            ${isFullscreen ? 'px-2 sm:px-4' : isSticky ? (stickyBounds ? 'px-0' : 'container-downloads mx-auto px-2 sm:px-4') : ''}
            ${isSticky ? 'py-2' : 'pb-4'}`}
        >
          <div className="flex min-w-0 w-full flex-col gap-2 sm:gap-2 xl:w-auto xl:flex-1 xl:flex-row xl:flex-wrap xl:items-center xl:gap-3">
            <ActionBarStatus itemTypeName={itemTypeName} itemTypePlural={itemTypePlural} />
            <ActionBarBulk itemTypeName={itemTypeName} itemTypePlural={itemTypePlural} />
          </div>

          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 xl:ml-auto xl:w-auto xl:shrink-0 xl:justify-end">
            <ActionBarSearch itemTypePlural={itemTypePlural} />
            <ActionBarControls />
          </div>
        </div>
      </div>
    </Fragment>
  );
}
