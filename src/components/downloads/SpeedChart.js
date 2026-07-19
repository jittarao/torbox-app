'use client';

import dynamic from 'next/dynamic';
import { useRef, useMemo, useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { loadLineChart } from '@/utils/chartComponents';

const Line = dynamic(() => loadLineChart(), { ssr: false });
import { formatSpeed } from './utils/formatters';
import { useSpeedData } from '../shared/hooks/useSpeedData';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectItemsForView } from '@/store/torboxDownloadsSelectors';
import { getItem, setItem } from '@/utils/storage';

// Theme colors from tailwind config
const THEME_COLORS = {
  download: {
    border: '#34D399', // label.success.text-dark
    background: 'rgba(52, 211, 153, 0.2)', // label.success.text-dark with opacity
  },
  upload: {
    border: '#F87171', // label.danger.text-dark
    background: 'rgba(248, 113, 113, 0.2)', // label.danger.text-dark with opacity
  },
  grid: {
    light: 'rgba(206, 206, 206, 0.2)', // border color with opacity
    dark: 'rgba(60, 60, 60, 0.2)', // border-dark color with opacity
  },
  text: {
    light: '#18181b', // primary.text
    dark: '#e5e7ebb3', // primary.text.dark
  },
};

// Helper to ensure valid data
const ensureValidData = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return [1024]; // Return 1 KB/s minimum instead of 0
  }
  return data.map((value) =>
    value === null || value === undefined || isNaN(value) || value < 1024
      ? 1024 // Use 1 KB/s as minimum value for logarithmic scale
      : value
  );
};

// Local storage key for chart expanded state
const CHART_EXPANDED_KEY = 'speedchart-expanded';

export default function SpeedChart({ items: itemsProp }) {
  const t = useTranslations('SpeedChart');
  const [timeRange, setTimeRange] = useState('10m');
  const [useLogScale, setUseLogScale] = useState(false);

  const getTorrentItems = useCallback(() => {
    if (itemsProp) return itemsProp;
    return selectItemsForView(useTorboxDownloadsStore.getState(), 'torrents');
  }, [itemsProp]);

  const speedData = useSpeedData(getTorrentItems, timeRange);
  const chartRef = useRef(null);
  const isMobile = useIsMobile();

  // State to track if the chart is expanded or collapsed
  const [isExpanded, setIsExpanded] = useState(() => {
    const savedState = getItem(CHART_EXPANDED_KEY);
    if (savedState !== null) return savedState === 'true';
    if (typeof window !== 'undefined') return window.innerWidth >= 1024;
    return false;
  });
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Listen for resize when no localStorage preference exists
  useEffect(() => {
    if (getItem(CHART_EXPANDED_KEY) !== null) return;

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsExpanded(true);
      } else {
        setIsExpanded(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save expanded state to localStorage when it changes
  useEffect(() => {
    if (isClient) {
      setItem(CHART_EXPANDED_KEY, isExpanded.toString());
    }
  }, [isExpanded, isClient]);

  // Track dark mode
  const isDarkMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

  // Update chart theme when dark mode changes
  useEffect(() => {
    const updateChartTheme = () => {
      if (!chartRef.current) return;

      const chart = chartRef.current;
      const isDark = document.documentElement.classList.contains('dark');

      // Update grid colors
      if (chart.options.scales.y.grid) {
        chart.options.scales.y.grid.color = isDark
          ? THEME_COLORS.grid.dark
          : THEME_COLORS.grid.light;
      }

      // Update text colors
      if (chart.options.plugins.title) {
        chart.options.plugins.title.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      if (chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      if (chart.options.scales.y.ticks) {
        chart.options.scales.y.ticks.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      if (chart.options.scales.x.ticks) {
        chart.options.scales.x.ticks.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      chart.update();
    };

    // Set up observer for dark mode changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateChartTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Initial update
    updateChartTheme();

    return () => {
      observer.disconnect();
    };
  }, []);

  // Get current speeds (last data point)
  const currentDownloadSpeed = useMemo(() => {
    return speedData.download.length > 0 ? speedData.download[speedData.download.length - 1] : 0;
  }, [speedData.download]);

  const currentUploadSpeed = useMemo(() => {
    return speedData.upload.length > 0 ? speedData.upload[speedData.upload.length - 1] : 0;
  }, [speedData.upload]);

  // Check if there's any activity (non-zero speeds)
  const hasActivity = useMemo(() => {
    if (!speedData.download.length || !speedData.upload.length) return false;

    // Check if any of the last 3 data points have non-zero values
    const recentDownloads = speedData.download.slice(-3);
    const recentUploads = speedData.upload.slice(-3);

    return recentDownloads.some((speed) => speed > 0) || recentUploads.some((speed) => speed > 0);
  }, [speedData]);

  // If no activity and no data points yet, don't render the chart
  if (!hasActivity && speedData.labels.length < 3) {
    return null;
  }

  // Don't render anything until client-side hydration is complete
  if (!isClient) return null;

  // Ensure we have valid data for the chart
  const validLabels = speedData.labels.length > 0 ? speedData.labels : ['0'];
  const validDownloadData = ensureValidData(speedData.download);
  const validUploadData = ensureValidData(speedData.upload);

  // Chart options and data
  const chartData = {
    labels: validLabels,
    datasets: [
      {
        label: t('labels.download'),
        data: validDownloadData,
        borderColor: THEME_COLORS.download.border,
        backgroundColor: THEME_COLORS.download.background,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: t('labels.upload'),
        data: validUploadData,
        borderColor: THEME_COLORS.upload.border,
        backgroundColor: THEME_COLORS.upload.background,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: useLogScale ? 'logarithmic' : 'linear',
        beginAtZero: !useLogScale,
        min: useLogScale ? 1024 : 0, // 1 KB/s minimum for log scale
        grid: {
          color: isDarkMode ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light,
        },
        ticks: {
          color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          callback: function (value) {
            return formatSpeed(value);
          },
          precision: 0,
          // Customize logarithmic scale ticks
          ...(useLogScale && {
            font: {
              size: 10,
            },
          }),
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            // Ensure value is a number and handle zero case properly
            if (value === null || value === undefined || isNaN(value) || value <= 0) {
              return `${label}: 0 B/s`;
            }
            return `${label}: ${formatSpeed(value)}`;
          },
        },
        titleColor: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
        backgroundColor: isDarkMode ? '#161618' : '#fafafa',
        borderColor: isDarkMode ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light,
        borderWidth: 1,
        bodyColor: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
        padding: 10,
      },
      legend: {
        display: false,
        position: 'top',
        labels: {
          color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 15,
        },
      },
      title: {
        display: false,
        text: 'Transfer Speeds',
        color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
        font: {
          size: 14,
        },
        padding: {
          bottom: 15,
        },
      },
    },
    animation: {
      duration: 500,
    },
    elements: {
      point: {
        radius: 2,
        hoverRadius: 4,
      },
    },
  };

  return (
    <div className="px-3 py-1.5 lg:px-3 lg:py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark shrink-0">
          {isMobile ? t('title.default') : t('title.full')}
        </h3>
        <div className="flex items-center gap-2 lg:gap-4 min-w-0">
          {/* Current speeds */}
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
          {/* Scale type toggle */}
          {isExpanded && !isMobile && (
            <button
              type="button"
              onClick={() => setUseLogScale(!useLogScale)}
              className="text-xs lg:text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded px-2 py-1 text-primary-text dark:text-primary-text-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
            >
              {useLogScale ? t('scale.logarithmic') : t('scale.linear')}
            </button>
          )}

          {/* Time range selector */}
          {isExpanded && !isMobile && (
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
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

          {/* Show/hide chart button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
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

      {isExpanded && (
        <div className="mt-4 h-64">
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
