'use client';

import ColumnManager from '../../ColumnManager';
import { COLUMNS } from '@/components/constants';
import { useDownloadsFilterContext } from '@/components/downloads/DownloadsFilterContext';
import { useDownloadsUIContext } from '@/components/downloads/DownloadsUIContext';
import { useDownloadsDataContext } from '@/components/downloads/DownloadsDataContext';
import useIsMobile from '@/hooks/useIsMobile';
import ViewControls from './ViewControls';

export default function ActionBarControls() {
  const { activeColumns, viewItems: unfilteredItems } = useDownloadsDataContext();
  const { handleColumnChange: onColumnChange } = useDownloadsFilterContext();
  const {
    activeType = 'torrents',
    isBlurred = false,
    setIsBlurred,
    isFullscreen = false,
    onFullscreenToggle,
    displayViewMode: viewMode = 'table',
    setViewMode: onViewModeChange,
    expandAllFiles,
    collapseAllFiles,
  } = useDownloadsUIContext();
  const isMobile = useIsMobile();

  const onBlurToggle = () => setIsBlurred(!isBlurred);

  return (
    <>
      <ViewControls
        isMobile={isMobile}
        isBlurred={isBlurred}
        onBlurToggle={onBlurToggle}
        isFullscreen={isFullscreen}
        onFullscreenToggle={onFullscreenToggle}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        expandAllFiles={expandAllFiles}
        collapseAllFiles={collapseAllFiles}
        unfilteredItems={unfilteredItems}
      />

      <div className="hidden shrink-0 lg:block">
        <ColumnManager
          columns={COLUMNS}
          activeColumns={activeColumns}
          onColumnChange={onColumnChange}
          activeType={activeType}
        />
      </div>
    </>
  );
}
