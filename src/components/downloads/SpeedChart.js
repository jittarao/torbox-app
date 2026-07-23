'use client';

import dynamic from 'next/dynamic';
import { useRef, useMemo, useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { loadLineChart } from '@/utils/chartComponents';
import { useSpeedData } from '../shared/hooks/useSpeedData';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectItemsForView } from '@/store/torboxDownloadsSelectors';
import { getItem, setItem } from '@/utils/storage';
import SpeedChartToolbar from './SpeedChartToolbar';
import {
  applyChartTheme,
  buildChartData,
  buildChartOptions,
  CHART_EXPANDED_KEY,
} from './speedChartConfig';

const Line = dynamic(() => loadLineChart(), { ssr: false });

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

  useEffect(() => {
    if (getItem(CHART_EXPANDED_KEY) !== null) return;

    const handleResize = () => {
      setIsExpanded(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isClient) {
      setItem(CHART_EXPANDED_KEY, isExpanded.toString());
    }
  }, [isExpanded, isClient]);

  const isDarkMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  }, []);

  useEffect(() => {
    const updateChartTheme = () => {
      applyChartTheme(chartRef.current, document.documentElement.classList.contains('dark'));
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

    return () => {
      observer.disconnect();
    };
  }, []);

  const currentDownloadSpeed = useMemo(() => {
    return speedData.download.length > 0 ? speedData.download[speedData.download.length - 1] : 0;
  }, [speedData.download]);

  const currentUploadSpeed = useMemo(() => {
    return speedData.upload.length > 0 ? speedData.upload[speedData.upload.length - 1] : 0;
  }, [speedData.upload]);

  const hasActivity = useMemo(() => {
    if (!speedData.download.length || !speedData.upload.length) return false;

    const recentDownloads = speedData.download.slice(-3);
    const recentUploads = speedData.upload.slice(-3);

    return recentDownloads.some((speed) => speed > 0) || recentUploads.some((speed) => speed > 0);
  }, [speedData]);

  if (!hasActivity && speedData.labels.length < 3) {
    return null;
  }

  if (!isClient) return null;

  const chartData = buildChartData({
    labels: speedData.labels,
    download: speedData.download,
    upload: speedData.upload,
    t,
  });
  const chartOptions = buildChartOptions({ isDarkMode, useLogScale });

  return (
    <div className="px-3 py-1.5 lg:px-3 lg:py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <SpeedChartToolbar
        t={t}
        isMobile={isMobile}
        isExpanded={isExpanded}
        hasActivity={hasActivity}
        currentDownloadSpeed={currentDownloadSpeed}
        currentUploadSpeed={currentUploadSpeed}
        useLogScale={useLogScale}
        timeRange={timeRange}
        onToggleLogScale={() => setUseLogScale(!useLogScale)}
        onTimeRangeChange={setTimeRange}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="mt-4 h-64">
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
