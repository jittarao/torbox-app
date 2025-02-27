'use client';

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

  return (
    <div className="mt-4 px-4 py-2 lg:p-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center gap-2 mb-2">
        <h3 className="text-md lg:text-lg font-medium text-primary-text dark:text-primary-text-dark">
          Download Links
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
              className="text-sm lg:text-md text-accent hover:text-accent/80 transition-colors"
            >
              Copy All Links
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-primary-text dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
            aria-label="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
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
              <span className="block w-full truncate mr-4 text-primary-text dark:text-primary-text-dark">
                {link.url}
              </span>
              <div
                className="absolute z-50 left-0 lg:left-full top-full lg:top-1/2 mt-1 lg:mt-0 lg:-translate-y-1/2 lg:ml-2
                p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark 
                rounded shadow-lg whitespace-nowrap 
                text-primary-text/70 dark:text-primary-text-dark/70 
                invisible group-hover:visible"
              >
                {link.name}
              </div>
            </div>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent dark:text-accent-dark hover:text-accent/80 
                dark:hover:text-accent-dark/80 transition-colors whitespace-nowrap select-none"
              title={`Download ${link.name}`}
            >
              Download
            </a>
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
