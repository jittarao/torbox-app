'use client';

export default function DownloadPanel({
  downloadLinks,
  isDownloading,
  downloadProgress,
  onDismiss,
  setToast
}) {
  if (!downloadLinks.length && !isDownloading) return null;

  const handleCopyLinks = () => {
    const text = downloadLinks.map(link => link.url).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setToast({
          message: 'Links copied to clipboard!',
          type: 'success'
        });
        setTimeout(() => setToast(null), 3000);
      })
      .catch(err => {
        setToast({
          message: 'Failed to copy links',
          type: 'error'
        });
        setTimeout(() => setToast(null), 3000);
      });
  };

  return (
    <div className="mt-4 p-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
          Download Links
          {isDownloading && (
            <span className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 ml-2">
              (Fetching {downloadProgress.current} of {downloadProgress.total})
            </span>
          )}
        </h3>
        <div className="flex gap-4 items-center">
          {downloadLinks.length > 0 && (
            <button
              onClick={handleCopyLinks}
              className="text-accent hover:text-accent/80 transition-colors"
            >
              Copy All Links
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-primary-text dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark transition-colors"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-96 overflow-x-hidden overflow-y-auto relative">
        {downloadLinks.map(link => (
          <div key={link.id} className="flex items-center justify-between 
            bg-surface-alt dark:bg-surface-alt-dark text-sm p-2 rounded 
            border border-border dark:border-border-dark">
            <div className="relative group">
              <span className="truncate mr-4 text-primary-text dark:text-primary-text-dark">
                {link.url}
              </span>
              <div className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2 
                p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark 
                rounded shadow-lg whitespace-nowrap 
                text-primary-text/70 dark:text-primary-text-dark/70 
                invisible group-hover:visible">
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
            style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
} 