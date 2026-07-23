import { formatSpeed } from './utils/formatters';

export default function SpeedChartToolbar({
  t,
  isMobile,
  isExpanded,
  hasActivity,
  currentDownloadSpeed,
  currentUploadSpeed,
  useLogScale,
  timeRange,
  onToggleLogScale,
  onTimeRangeChange,
  onToggleExpanded,
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark shrink-0">
        {isMobile ? t('title.default') : t('title.full')}
      </h3>
      <div className="flex items-center gap-2 lg:gap-4 min-w-0">
        {hasActivity && (
          <div className="flex items-center gap-x-3 shrink-0">
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-label-success-text-dark dark:bg-label-success-text-dark"></span>
              <span className="text-xs font-medium text-primary-text dark:text-primary-text-dark whitespace-nowrap">
                ↓ {formatSpeed(currentDownloadSpeed)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-label-danger-text-dark dark:bg-label-danger-text-dark"></span>
              <span className="text-xs font-medium text-primary-text dark:text-primary-text-dark whitespace-nowrap">
                ↑ {formatSpeed(currentUploadSpeed)}
              </span>
            </div>
          </div>
        )}
        {isExpanded && !isMobile && (
          <button
            type="button"
            onClick={onToggleLogScale}
            className="text-xs lg:text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded px-2 py-1 text-primary-text dark:text-primary-text-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
          >
            {useLogScale ? t('scale.logarithmic') : t('scale.linear')}
          </button>
        )}
        {isExpanded && !isMobile && (
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            className="text-xs lg:text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded px-2 py-1 text-primary-text dark:text-primary-text-dark focus:outline-none"
          >
            <option value="1m">{t('timeRanges.1m')}</option>
            <option value="10m">{t('timeRanges.10m')}</option>
            <option value="1h">{t('timeRanges.1h')}</option>
            <option value="3h">{t('timeRanges.3h')}</option>
            <option value="6h">{t('timeRanges.6h')}</option>
            <option value="all">{t('timeRanges.all')}</option>
          </select>
        )}
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
          aria-expanded={isExpanded}
        >
          {isExpanded ? t('chart.hide') : t('chart.show')}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`size-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
