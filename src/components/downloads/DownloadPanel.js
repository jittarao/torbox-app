'use client';

import { Icons } from '@/components/constants';
import Tooltip from '@/components/shared/Tooltip';
export default function DownloadPanel({
  downloadLinks,
  isDownloading,
  downloadProgress,
  onDismiss,
  setToast,
}) {
  if (!downloadLinks.length && !isDownloading) return null;
  const handleCopyLinks = () => {
    const text = downloadLinks.map((link) => link.url).join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setToast({
          message: 'Links copied to clipboard!',
          type: 'success',
        });
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => {
        setToast({
          message: 'Failed to copy links',
          type: 'error',
        });
        setTimeout(() => setToast(null), 5000);
      });
  };

  const handleCopyLink = (link) => {
    navigator.clipboard
      .writeText(link.url)
      .then(() => {
        setToast({
          message: 'Link copied to clipboard!',
          type: 'success',
        });
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => {
        setToast({
          message: 'Failed to copy link',
          type: 'error',
        });
        setTimeout(() => setToast(null), 5000);
      });
  };

  return (
    <div className="mt-4 px-4 py-2 lg:p-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center gap-2 mb-2">
        <h3 className="text-md lg:text-lg font-medium text-primary-text dark:text-primary-text-dark">
          Download Link{downloadLinks.length > 1 ? 's' : ''}
          {isDownloading && (
            <span className="block lg:inline text-sm text-primary-text/70 dark:text-primary-text-dark/70 lg:ml-2">
              (Fetching {downloadProgress.current} of {downloadProgress.total})
            </span>
          )}
        </h3>
        <div className="flex items-center gap-4">
          {downloadLinks.length > 0 && (
            <button
              onClick={handleCopyLinks}
              className="flex items-center gap-1.5 text-sm lg:text-md text-accent hover:text-accent/80 transition-colors"
            >
              {Icons.copy}
              Copy Link{downloadLinks.length > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-primary-text dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
            aria-label="Close panel"
          >
            {Icons.times}
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-[50vh] lg:max-h-96 overflow-x-hidden overflow-y-auto relative">
        {downloadLinks.map((link) => (
          <div
            key={link.id}
            className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-0 lg:justify-between 
            bg-surface-alt dark:bg-surface-alt-dark text-sm p-2 rounded 
            border border-border dark:border-border-dark"
          >
            <div className="relative group max-w-full">
              <Tooltip content={link.name}>
                <span className="block w-full truncate mr-4 text-primary-text dark:text-primary-text-dark">
                  {link.url}
                </span>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyLink(link)}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors select-none"
              >
                {Icons.copy}
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors select-none"
                title="Download File"
              >
                {Icons.download}
              </a>
            </div>
          </div>
        ))}
        {isDownloading && downloadLinks.length < downloadProgress.total && (
          <div className="text-primary-text dark:text-primary-text-dark/50 text-sm p-2 animate-pulse">
            Generating more links...
          </div>
        )}
      </div>

      {isDownloading && (
        <div className="mt-4 w-full bg-border rounded-full h-2.5">
          <div
            className="bg-accent h-2.5 rounded-full transition-all duration-300"
            style={{
              width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
            }}
          ></div>
        </div>
      )}
    </div>
  );
}
