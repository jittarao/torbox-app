'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

const Bar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Bar), { ssr: false });
import { format, parseISO } from 'date-fns';
import { useTranslations, useLocale } from 'next-intl';
import { formatSize, SIZE_BASE_DECIMAL } from '@/components/downloads/utils/formatters';
import { AlertCircle, BarChart3 } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const THEME_COLORS = {
  download: {
    border: '#34D399',
    background: 'rgba(52, 211, 153, 0.5)',
  },
  grid: {
    light: 'rgba(206, 206, 206, 0.2)',
    dark: 'rgba(60, 60, 60, 0.2)',
  },
  text: {
    light: '#1F321A',
    dark: '#e5e7ebb3',
  },
};

const GROUPING_OPTIONS = ['hour', 'day', 'week', 'month'];

const DATE_FORMATS = {
  hour: 'MMM d, HH:mm',
  day: 'MMM d',
  week: 'MMM d',
  month: 'MMM yyyy',
};

function formatDateLabel(dateStr, grouping) {
  try {
    const date = parseISO(dateStr);
    return format(date, DATE_FORMATS[grouping] || DATE_FORMATS.day);
  } catch {
    return dateStr;
  }
}

export default function BandwidthChart({
  bandwidthData,
  grouping,
  onGroupingChange,
  loading,
  error,
  onRetry,
}) {
  const t = useTranslations('User.bandwidth');
  const locale = useLocale();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const chartRef = useRef(null);

  const isDarkMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

  useEffect(() => {
    const updateChartTheme = () => {
      if (!chartRef.current) return;

      const chart = chartRef.current;
      const isDark = document.documentElement.classList.contains('dark');

      if (chart.options.scales?.y?.grid) {
        chart.options.scales.y.grid.color = isDark
          ? THEME_COLORS.grid.dark
          : THEME_COLORS.grid.light;
      }

      if (chart.options.scales?.y?.ticks) {
        chart.options.scales.y.ticks.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      if (chart.options.scales?.x?.ticks) {
        chart.options.scales.x.ticks.color = isDark
          ? THEME_COLORS.text.dark
          : THEME_COLORS.text.light;
      }

      chart.update();
    };

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

    updateChartTheme();

    return () => observer.disconnect();
  }, []);

  const hasData = useMemo(() => {
    return bandwidthData.length > 0 && bandwidthData.some((point) => point.bytes_downloaded > 0);
  }, [bandwidthData]);

  const chartLabels = useMemo(
    () => bandwidthData.map((point) => formatDateLabel(point.date, grouping)),
    [bandwidthData, grouping]
  );

  const chartValues = useMemo(
    () => bandwidthData.map((point) => point.bytes_downloaded || 0),
    [bandwidthData]
  );

  const chartData = useMemo(
    () => ({
      labels: chartLabels,
      datasets: [
        {
          label: t('title'),
          data: chartValues,
          borderColor: THEME_COLORS.download.border,
          backgroundColor: THEME_COLORS.download.background,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    }),
    [chartLabels, chartValues, t]
  );

  const formatBandwidth = useCallback(
    (bytes) => formatSize(bytes, locale, SIZE_BASE_DECIMAL),
    [locale]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: isDarkMode ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light,
          },
          ticks: {
            color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
            callback: (value) => formatBandwidth(value),
            maxTicksLimit: 6,
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: grouping === 'hour' ? 12 : 8,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context) => formatBandwidth(context.parsed.y),
          },
          titleColor: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
          borderColor: isDarkMode ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light,
          borderWidth: 1,
          bodyColor: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          padding: 10,
        },
      },
      animation: {
        duration: 400,
      },
    }),
    [isDarkMode, grouping, formatBandwidth]
  );

  if (!isClient) {
    return null;
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-accent dark:text-accent-dark" />
          <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
            {t('title')}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="bandwidth-grouping" className="text-sm text-muted dark:text-muted-dark">
            {t('grouping')}
          </label>
          <select
            id="bandwidth-grouping"
            value={grouping}
            onChange={(e) => onGroupingChange(e.target.value)}
            disabled={loading}
            className="text-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded px-2 py-1 text-primary-text dark:text-primary-text-dark focus:outline-none disabled:opacity-50"
          >
            {GROUPING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`groupingOptions.${option}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12">
          <AlertCircle className="size-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <p className="text-muted dark:text-muted-dark mb-4">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="text-center py-12">
          <BarChart3 className="size-12 text-muted dark:text-muted-dark mx-auto mb-4" />
          <p className="text-muted dark:text-muted-dark">{t('empty')}</p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="h-64">
          <Bar ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
