'use client';
import { useTorrentUpload } from './hooks/useTorrentUpload';
import { DropZone } from './DropZone';

export default function TorrentUploader({ apiKey }) {
  const {
    items,
    magnetInput,
    uploading,
    progress,
    error,
    setMagnetInput,
    validateAndAddFiles,
    uploadTorrents,
    removeItem,
    resetUploader,
    globalOptions,
    updateGlobalOptions,
    updateItemOptions,
    showOptions,
    setShowOptions,
  } = useTorrentUpload(apiKey);

  const handleDismiss = () => {
    resetUploader();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setMagnetInput(e.target.value);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg dark:text-gray-100">Upload Torrents</h3>
        <button
          onClick={() => setShowOptions(prev => !prev)}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 
            dark:hover:text-gray-200 flex items-center gap-1"
        >
          <span>{showOptions ? 'Hide' : 'Show'} Options</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform duration-200 ${showOptions ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <textarea
            value={magnetInput}
            onChange={(e) => setMagnetInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              // Allow default paste behavior then process
              setTimeout(() => setMagnetInput(e.target.value), 0);
            }}
            disabled={uploading}
            placeholder="Paste magnet links here (one per line)"
            className="w-full min-h-40 h-40 p-3 border border-gray-200 dark:border-gray-700 rounded-lg 
              bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-50 dark:disabled:bg-gray-900 transition-colors duration-200"
          />
        </div>

        <div>
          <DropZone onDrop={validateAndAddFiles} disabled={uploading} />
        </div>
      </div>

      <div className={`mt-4 transition-all duration-300 ease-in-out overflow-hidden ${
        showOptions ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-4 dark:text-gray-200">Global Upload Options</h4>
          <div className="flex items-center gap-8">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Seeding Preference
              </label>
              <select
                value={globalOptions.seed}
                onChange={(e) => updateGlobalOptions({ seed: Number(e.target.value) })}
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-white dark:bg-gray-700 
                  dark:border-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>Auto (Default)</option>
                <option value={2}>Always Seed</option>
                <option value={3}>Never Seed</option>
              </select>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={globalOptions.allowZip}
                  onChange={(e) => updateGlobalOptions({ allowZip: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 
                    focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    Allow Zip
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    For torrents with 100+ files
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={globalOptions.asQueued}
                  onChange={(e) => updateGlobalOptions({ asQueued: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 
                    focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    Instant Queue
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Skip waiting queue
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex-1">
              <span className="text-sm font-medium dark:text-gray-200">{item.name}</span>
              {item.status === 'queued' && (
                <div className="flex gap-4 mt-2">
                  <select
                    value={item.seed}
                    onChange={(e) => updateItemOptions(index, { seed: Number(e.target.value) })}
                    className="text-xs p-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={1}>Auto Seed</option>
                    <option value={2}>Always Seed</option>
                    <option value={3}>Never Seed</option>
                  </select>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={item.allowZip}
                      onChange={(e) => updateItemOptions(index, { allowZip: e.target.checked })}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Zip</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={item.asQueued}
                      onChange={(e) => updateItemOptions(index, { asQueued: e.target.checked })}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Queue</span>
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.status === 'queued' && !uploading && (
                <button
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-600 transition-colors duration-200"
                >
                  Remove
                </button>
              )}
              {item.status === 'success' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              )}
              {item.status === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              )}
              {item.status === 'processing' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-500 animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              )}
              {item.status === 'queued' && uploading && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="text-red-500 mt-3 text-sm">{error}</div>}

      {uploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
            Uploading {progress.current} of {progress.total}
          </div>
        </div>
      )}

      {items.filter(item => item.status === 'queued').length > 0 && !uploading && (
        <div className="flex justify-end">
          <button
            onClick={uploadTorrents}
            disabled={uploading}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white text-sm px-6 py-2 rounded-md
            transition-colors duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
            Upload {items.filter(item => item.status === 'queued').length} items
          </button>
        </div>
      )}

      {items.length > 0 && !items.some(item => item.status === 'queued' || item.status === 'processing') && (
        <div className="flex gap-4 items-center justify-end mt-4">
          <h3 className="text-md dark:text-gray-100">
            {items.filter(item => item.status === 'success').length} of {items.length} torrents processed
          </h3>

          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close panel"
          >
            Clear torrents
          </button>
        </div>
      )}
    </div>
  );
}