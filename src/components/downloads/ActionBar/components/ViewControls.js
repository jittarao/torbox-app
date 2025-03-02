import { Icons } from '@/components/constants';

export default function ViewControls({
  isBlurred,
  onBlurToggle,
  isFullscreen,
  onFullscreenToggle,
  viewMode,
  onViewModeChange,
  setSelectedItems,
}) {
  const handleViewModeChange = (mode) => {
    setSelectedItems({ items: new Set(), files: new Map() });
    onViewModeChange(mode);
    localStorage.setItem('downloads-view-mode', mode);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Table and card view buttons */}
      <div className="flex items-center gap-0">
        <button
          onClick={() => handleViewModeChange('table')}
          className={`px-3 py-1.5 text-sm border rounded-md rounded-r-none transition-colors 
          ${
            viewMode === 'table'
              ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
              : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
          }`}
          title="Table View"
        >
          {Icons.table}
        </button>
        <button
          onClick={() => handleViewModeChange('card')}
          className={`px-3 py-1.5 text-sm border rounded-md rounded-l-none transition-colors
          ${
            viewMode === 'card'
              ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
              : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
          }`}
          title="Card View"
        >
          {Icons.list}
        </button>
      </div>

      {/* Blur button */}
      <button
        onClick={onBlurToggle}
        className={`px-3 py-1.5 text-sm border rounded-md transition-colors
          ${
            isBlurred
              ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
              : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
          }`}
        title={isBlurred ? 'Show sensitive content' : 'Hide sensitive content'}
      >
        {isBlurred ? Icons.eye : Icons.eyeOff}
      </button>

      {/* Fullscreen button */}
      <button
        onClick={onFullscreenToggle}
        className={`px-3 py-1.5 text-sm border rounded-md transition-colors
          ${
            isFullscreen
              ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
              : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
          }`}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? Icons.minimize : Icons.maximize}
      </button>
    </div>
  );
}
