'use client';

import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

function ToolbarButton({ active, onClick, title, children, className = '' }) {
  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        aria-pressed={active}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 dark:focus-visible:ring-accent-dark/30
          ${
            active
              ? 'border-accent bg-accent/10 text-accent dark:border-accent-dark dark:bg-accent-dark/10 dark:text-accent-dark'
              : 'border-border bg-surface-alt text-primary-text/70 hover:border-primary-text/30 hover:bg-surface-alt-hover hover:text-primary-text dark:border-border-dark dark:bg-surface-alt-dark dark:text-primary-text-dark/70 dark:hover:border-primary-text-dark/30 dark:hover:bg-surface-alt-hover-dark dark:hover:text-primary-text-dark'
          }
          ${className}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export default function ViewControls({
  isMobile,
  isBlurred,
  onBlurToggle,
  isFullscreen,
  onFullscreenToggle,
  viewMode,
  onViewModeChange,
  expandAllFiles,
  collapseAllFiles,
  expandedItems,
  unfilteredItems,
}) {
  const t = useTranslations('ViewControls');

  const handleViewModeChange = (mode) => {
    onViewModeChange(mode);
    localStorage.setItem('downloads-view-mode', mode);
  };

  const itemsWithFiles =
    unfilteredItems?.filter((item) => item.files && item.files.length > 0) ?? [];
  const hasItemsWithFiles = itemsWithFiles.length > 0;
  const allExpanded =
    hasItemsWithFiles && itemsWithFiles.every((item) => expandedItems.has(item.id));

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 sm:overflow-visible sm:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="toolbar"
      aria-label={t('toolbarLabel')}
    >
      {!isMobile && (
        <div
          className="flex shrink-0 overflow-hidden rounded-lg border border-border dark:border-border-dark"
          role="group"
          aria-label={t('viewModeGroup')}
        >
          <ToolbarButton
            active={viewMode === 'table'}
            onClick={() => handleViewModeChange('table')}
            title={t('tableView')}
            className="!h-10 !w-10 rounded-none border-0 border-r border-border dark:border-border-dark"
          >
            <Icons.Table />
          </ToolbarButton>
          <ToolbarButton
            active={viewMode === 'card'}
            onClick={() => handleViewModeChange('card')}
            title={t('cardView')}
            className="!h-10 !w-10 rounded-none border-0"
          >
            <Icons.List />
          </ToolbarButton>
        </div>
      )}

      <ToolbarButton
        active={isBlurred}
        onClick={onBlurToggle}
        title={isBlurred ? t('showSensitive') : t('hideSensitive')}
      >
        {isBlurred ? <Icons.Eye /> : <Icons.EyeOff />}
      </ToolbarButton>

      <ToolbarButton
        active={isFullscreen}
        onClick={onFullscreenToggle}
        title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
      >
        {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
      </ToolbarButton>

      {hasItemsWithFiles && (
        <ToolbarButton
          active={allExpanded}
          onClick={() => (allExpanded ? collapseAllFiles() : expandAllFiles())}
          title={allExpanded ? t('collapseAllFiles') : t('expandAllFiles')}
        >
          {allExpanded ? <Icons.CollapseAll /> : <Icons.ExpandAll />}
        </ToolbarButton>
      )}
    </div>
  );
}
