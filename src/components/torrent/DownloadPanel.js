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
        setToast('Links copied to clipboard!');
        setTimeout(() => setToast(null), 3000);
      })
      .catch(err => {
        setToast('Failed to copy links');
        setTimeout(() => setToast(null), 3000);
      });
  };

  return (
    <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium dark:text-gray-100">
          Download Links
          {isDownloading && (
            <span className="text-sm text-gray-600 dark:text-gray-300 ml-2">
              (Fetching {downloadProgress.current} of {downloadProgress.total})
            </span>
          )}
        </h3>
        <div className="flex gap-4 items-center">
          {downloadLinks.length > 0 && (
            <button
              onClick={handleCopyLinks}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Copy All Links
            </button>
          )}
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {downloadLinks.map(link => (
          <div key={link.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded">
            <span className="truncate mr-4 dark:text-gray-100">{link.url}</span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 whitespace-nowrap select-none"
            >
              Download
            </a>
          </div>
        ))}
        {isDownloading && downloadLinks.length < downloadProgress.total && (
          <div className="text-sm text-gray-500 dark:text-gray-300 p-2 animate-pulse">
            Generating more links...
          </div>
        )}
      </div>

      {isDownloading && (
        <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
} 