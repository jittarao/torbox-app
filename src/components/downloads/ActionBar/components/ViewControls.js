'use client';

import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

const toolbarBtnBase =
  'px-3 py-1.5 text-sm border rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/30 dark:focus-visible:ring-accent-dark/30';

function toolbarBtnClass(active, { segment, otherActive } = {}) {
  const inactive =
    'border-border text-primary-text/70 hover:text-primary-text dark:border-border-dark dark:text-primary-text-dark/70 dark:hover:text-primary-text-dark';
  const activeAccent = 'border-accent text-accent dark:border-accent-dark dark:text-accent-dark';

  if (!active) {
    const hideSharedBorder =
      segment === 'left' && otherActive
        ? ' border-r-transparent dark:border-r-transparent'
        : segment === 'right' && otherActive
          ? ' border-l-transparent dark:border-l-transparent'
          : '';
    return `${toolbarBtnBase} ${inactive}${hideSharedBorder}`;
  }

  const raised = segment ? ' relative z-10' : '';
  return `${toolbarBtnBase} ${activeAccent}${raised}`;
}

function ToolbarButton({ active, onClick, title, children, className = '', segment, otherActive }) {
  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        aria-pressed={active}
        className={`${toolbarBtnClass(active, { segment, otherActive })} ${className}`}
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
      className="flex shrink-0 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible"
      role="toolbar"
      aria-label={t('toolbarLabel')}
    >
      {!isMobile && (
        <div className="flex items-center gap-0" role="group" aria-label={t('viewModeGroup')}>
          <ToolbarButton
            active={viewMode === 'table'}
            otherActive={viewMode === 'card'}
            onClick={() => handleViewModeChange('table')}
            title={t('tableView')}
            segment="left"
            className="rounded-r-none"
          >
            <Icons.Table />
          </ToolbarButton>
          <ToolbarButton
            active={viewMode === 'card'}
            otherActive={viewMode === 'table'}
            onClick={() => handleViewModeChange('card')}
            title={t('cardView')}
            segment="right"
            className="rounded-l-none -ml-px"
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
