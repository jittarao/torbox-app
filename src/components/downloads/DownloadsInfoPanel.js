'use client';

import SpeedChart from './SpeedChart';
import DownloadPanel from './DownloadPanel';
import DownloadsUploaders from './DownloadsUploaders';
import UsageCallout from './UsageCallout';
import ReferralCallout from '@/components/referral/ReferralCallout';

export default function DownloadsInfoPanel({
  apiKey,
  activeType,
  permissions,
  downloadLinks,
  isDownloading,
  downloadProgress,
  setDownloadLinks,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
  setToast,
}) {
  return (
    <>
      <DownloadsUploaders apiKey={apiKey} activeType={activeType} permissions={permissions} />
      <SpeedChart />
      <DownloadPanel
        downloadLinks={downloadLinks}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onDismiss={() => setDownloadLinks([])}
        isDownloadPanelOpen={isDownloadPanelOpen}
        setIsDownloadPanelOpen={setIsDownloadPanelOpen}
        setToast={setToast}
      />
      {apiKey && <UsageCallout apiKey={apiKey} planId={permissions?.planId} />}
      <ReferralCallout apiKey={apiKey} variant="compact" onToast={setToast} />
    </>
  );
}
