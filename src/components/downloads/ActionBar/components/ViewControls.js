import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function ViewControls({
  isBlurred,
  onBlurToggle,
  isFullscreen,
  onFullscreenToggle,
  viewMode,
  onViewModeChange,
}) {
  const t = useTranslations('ViewControls');

  const handleViewModeChange = (mode) => {
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
          title={t('tableView')}
        >
          <Icons.Table />
        </button>
        <button
          onClick={() => handleViewModeChange('card')}
          className={`px-3 py-1.5 text-sm border rounded-md rounded-l-none transition-colors
          ${
            viewMode === 'card'
              ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
              : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
          }`}
          title={t('cardView')}
        >
          <Icons.List />
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
        title={isBlurred ? t('showSensitive') : t('hideSensitive')}
      >
        {isBlurred ? <Icons.Eye /> : <Icons.EyeOff />}
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
        title={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
      >
        {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
      </button>
    </div>
  );
}
