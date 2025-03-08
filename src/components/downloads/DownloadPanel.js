'use client';

import Icons from '@/components/icons';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';

export default function DownloadPanel({
  downloadLinks,
  isDownloading,
  downloadProgress,
  onDismiss,
  setToast,
  isDownloadPanelOpen,
  setIsDownloadPanelOpen,
}) {
  const t = useTranslations('DownloadPanel');

  if (!downloadLinks.length && !isDownloading) return null;

  const handleCopyLinks = () => {
    const text = downloadLinks.map((link) => link.url).join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setToast({
          message: t('toast.linksCopied'),
          type: 'success',
        });
      })
      .catch((err) => {
        setToast({
          message: t('toast.copyAllFailed'),
          type: 'error',
        });
      });
  };

  const handleCopyLink = (link) => {
    navigator.clipboard
      .writeText(link.url)
      .then(() => {
        setToast({
          message: t('toast.linkCopied'),
          type: 'success',
        });
      })
      .catch((err) => {
        setToast({
          message: t('toast.copyFailed'),
          type: 'error',
        });
      });
  };

  const PanelTitle = () => {
    return (
      <>
        <span>
          {downloadLinks.length > 1 ? t('title.multiple') : t('title.single')}
        </span>
        {isDownloading && (
          <span className="block lg:inline text-sm text-primary-text/70 dark:text-primary-text-dark/70 lg:ml-2">
            {t('status.fetching', {
              current: downloadProgress.current,
              total: downloadProgress.total,
            })}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      {/* Minimized State */}
      {!isDownloadPanelOpen && (
        <div className="max-w-4xl mx-auto px-4">
          <div
            className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-t-lg shadow-lg p-3 cursor-pointer hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
            onClick={() => setIsDownloadPanelOpen(true)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full text-accent/60 dark:text-accent-dark/60 bg-accent/10 dark:bg-accent-dark/10">
                  <Icons.Download className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                  <PanelTitle />
                </h3>
              </div>
              <button className="text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors">
                <Icons.ChevronUp className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maximized State */}
      {isDownloadPanelOpen && (
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative">
            <div className="mt-4 border border-border dark:border-border-dark rounded-t-lg bg-surface dark:bg-surface-dark shadow-lg">
              {/* Header */}
              <div
                className="flex items-center justify-between p-3 border-b border-border dark:border-border-dark cursor-pointer hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
                onClick={() => setIsDownloadPanelOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-md font-medium text-primary-text dark:text-primary-text-dark">
                    <PanelTitle />
                  </h3>
                </div>
                <button className="text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors">
                  <Icons.ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Links */}
              <div className="p-4">
                <div className="max-h-[80vh] lg:max-h-md overflow-x-hidden overflow-y-auto flex flex-col gap-2">
                  {downloadLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 
                      bg-surface-alt dark:bg-surface-alt-dark text-sm p-3 rounded-lg 
                      border border-border dark:border-border-dark transition-colors"
                    >
                      <div className="relative group min-w-0 flex-1">
                        <Tooltip content={link.name}>
                          <span className="block w-full truncate text-primary-text dark:text-primary-text-dark">
                            {link.url}
                          </span>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyLink(link)}
                          className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                            hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors select-none"
                          title={t('actions.copyLink')}
                        >
                          <Icons.Copy className="w-5 h-5" />
                        </button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                            hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors select-none"
                          title={t('actions.downloadFile')}
                        >
                          <Icons.Download className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  ))}
                  {isDownloading &&
                    downloadLinks.length < downloadProgress.total && (
                      <div className="text-primary-text dark:text-primary-text-dark/50 text-sm py-2 animate-pulse">
                        {downloadLinks.length > 0
                          ? t('status.generatingMore')
                          : t('status.generating')}
                      </div>
                    )}
                </div>

                {isDownloading && (
                  <div className="mt-2 w-full bg-border rounded-full h-2.5">
                    <div
                      className="bg-accent h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-end gap-4">
                  <button
                    onClick={onDismiss}
                    className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
                  >
                    {t('actions.clearAll')}
                  </button>
                  <button
                    onClick={handleCopyLinks}
                    className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
                  >
                    <Icons.Copy className="w-5 h-5" />
                    {t('actions.copyAll')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
