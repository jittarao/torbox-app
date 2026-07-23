import { formatSpeed } from './utils/formatters';

export const THEME_COLORS = {
  download: {
    border: '#34D399',
    background: 'rgba(52, 211, 153, 0.2)',
  },
  upload: {
    border: '#F87171',
    background: 'rgba(248, 113, 113, 0.2)',
  },
  grid: {
    light: 'rgba(206, 206, 206, 0.2)',
    dark: 'rgba(60, 60, 60, 0.2)',
  },
  text: {
    light: '#18181b',
    dark: '#e5e7ebb3',
  },
};

export const CHART_EXPANDED_KEY = 'speedchart-expanded';

export function ensureValidData(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return [1024];
  }
  return data.map((value) =>
    value === null || value === undefined || isNaN(value) || value < 1024 ? 1024 : value
  );
}

export function buildChartData({ labels, download, upload, t }) {
  return {
    labels: labels.length > 0 ? labels : ['0'],
    datasets: [
      {
        label: t('labels.download'),
        data: ensureValidData(download),
        borderColor: THEME_COLORS.download.border,
        backgroundColor: THEME_COLORS.download.background,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
      {
        label: t('labels.upload'),
        data: ensureValidData(upload),
        borderColor: THEME_COLORS.upload.border,
        backgroundColor: THEME_COLORS.upload.background,
        fill: true,
        tension: 0.4,
        borderWidth: 2,
      },
    ],
  };
}

export function buildChartOptions({ isDarkMode, useLogScale }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: useLogScale ? 'logarithmic' : 'linear',
        beginAtZero: !useLogScale,
        min: useLogScale ? 1024 : 0,
        grid: {
          color: isDarkMode ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light,
        },
        ticks: {
          color: isDarkMode ? THEME_COLORS.text.dark : THEME_COLORS.text.light,
          callback: function (value) {
            return formatSpeed(value);
          },
          precision: 0,
          ...(useLogScale && {
            font: { size: 10 },
          }),
        },
      },
      x: {
        grid: { display: false },
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
        font: { size: 14 },
        padding: { bottom: 15 },
      },
    },
    animation: { duration: 500 },
    elements: {
      point: { radius: 2, hoverRadius: 4 },
    },
  };
}

export function applyChartTheme(chart, isDark) {
  if (!chart) return;

  if (chart.options.scales.y.grid) {
    chart.options.scales.y.grid.color = isDark ? THEME_COLORS.grid.dark : THEME_COLORS.grid.light;
  }

  if (chart.options.plugins.title) {
    chart.options.plugins.title.color = isDark ? THEME_COLORS.text.dark : THEME_COLORS.text.light;
  }

  if (chart.options.plugins.legend) {
    chart.options.plugins.legend.labels.color = isDark
      ? THEME_COLORS.text.dark
      : THEME_COLORS.text.light;
  }

  if (chart.options.scales.y.ticks) {
    chart.options.scales.y.ticks.color = isDark ? THEME_COLORS.text.dark : THEME_COLORS.text.light;
  }

  if (chart.options.scales.x.ticks) {
    chart.options.scales.x.ticks.color = isDark ? THEME_COLORS.text.dark : THEME_COLORS.text.light;
  }

  chart.update();
}
