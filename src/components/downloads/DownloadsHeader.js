'use client';

import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import AutoRefreshIndicator from '@/components/downloads/AutoRefreshIndicator';
import FetchStatusBanner from '@/components/downloads/FetchStatusBanner';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import { useTranslations } from 'next-intl';

export default function DownloadsHeader({
  apiKey,
  onApiKeyChange,
  activeType,
  setActiveType,
  isTypeAvailable,
  pollSchedule,
  isRefreshing,
  canManualRefresh,
  fetchItems,
  fetchError,
  dismissError,
  lastSuccessfulFetchAt,
  refreshBlockedReason,
  pollingPaused,
  fetchStatusT,
}) {
  return (
    <>
      {onApiKeyChange && (
        <ApiKeyInput
          value={apiKey}
          onKeyChange={onApiKeyChange}
          allowKeyManager={true}
          variant="compact"
        />
      )}

      <div className="relative flex items-center border-b border-border dark:border-border-dark md:block">
        <div className="min-w-0 flex-1 [&>div]:border-b-0">
          <AssetTypeTabs
            activeType={activeType}
            onTypeChange={setActiveType}
            isTypeAvailable={isTypeAvailable}
          />
        </div>
        {apiKey && (
          <AutoRefreshIndicator
            className="shrink-0 px-2 md:absolute md:right-3 md:top-1/2 md:-translate-y-1/2 md:px-0 z-10"
            pollSchedule={pollSchedule}
            isRefreshing={isRefreshing}
            refreshRateLimited={!canManualRefresh}
            onRefreshNow={() => fetchItems()}
          />
        )}
      </div>

      <FetchStatusBanner
        error={fetchError}
        onDismissError={dismissError}
        onRetry={() => fetchItems()}
        lastSuccessfulFetchAt={lastSuccessfulFetchAt}
        refreshBlockedReason={refreshBlockedReason}
        pollingPaused={pollingPaused}
      />

      {isRefreshing && (
        <p className="text-xs text-secondary-text dark:text-secondary-text-dark text-center py-1">
          {fetchStatusT('refreshing')}
        </p>
      )}
    </>
  );
}
