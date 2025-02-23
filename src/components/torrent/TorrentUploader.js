'use client';
import { useTorrentUpload } from './hooks/useTorrentUpload';
import { DropZone } from './DropZone';
import Spinner from '../shared/Spinner';

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
        <h3 className="text-lg text-primary-text dark:text-primary-text-dark">
          Upload Torrents
        </h3>
        <button
          onClick={() => setShowOptions(prev => !prev)}
          className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark 
            flex items-center gap-1 transition-colors"
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
              setTimeout(() => setMagnetInput(e.target.value), 0);
            }}
            disabled={uploading}
            placeholder="Paste magnet links here (one per line)"
            className="w-full min-h-40 h-40 p-3 border border-border dark:border-border-dark rounded-lg 
              bg-transparent text-primary-text dark:text-primary-text-dark 
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
              focus:border-accent dark:focus:border-accent-dark
              disabled:bg-surface-alt dark:disabled:bg-surface-alt-dark 
              disabled:text-primary-text/50 dark:disabled:text-primary-text-dark/50
              transition-colors duration-200"
          />
        </div>

        <div>
          <DropZone onDrop={validateAndAddFiles} disabled={uploading} />
        </div>
      </div>

      <div className={`${showOptions ? 'mt-4' : 'mt-0'} transition-all duration-300 ease-in-out overflow-hidden ${
        showOptions ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="bg-surface-alt/50 dark:bg-surface-alt-dark p-4 rounded-lg 
          border border-border dark:border-border-dark">
          <h4 className="text-sm font-medium mb-4 text-primary-text dark:text-primary-text-dark">
            Global Upload Options
          </h4>
          <div className="flex items-center gap-8">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-xs text-primary-text/70 dark:text-primary-text-dark/70 
                uppercase tracking-wide mb-1">
                Seeding Preference
              </label>
              <select
                value={globalOptions.seed}
                onChange={(e) => updateGlobalOptions({ seed: Number(e.target.value) })}
                className="w-full px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-md 
                  bg-transparent text-primary-text dark:text-primary-text-dark 
                  focus:ring-1 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
                  focus:border-accent dark:focus:border-accent-dark transition-colors"
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
                  className="w-4 h-4 accent-accent dark:accent-accent-dark"
                />
                <div>
                  <span className="text-sm text-primary-text dark:text-primary-text-dark 
                    group-hover:text-primary dark:group-hover:text-primary-text-dark">
                    Allow Zip
                  </span>
                  <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                    For torrents with 100+ files
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={globalOptions.asQueued}
                  onChange={(e) => updateGlobalOptions({ asQueued: e.target.checked })}
                  className="w-4 h-4 accent-accent dark:accent-accent-dark"
                />
                <div>
                  <span className="text-sm text-primary-text dark:text-primary-text-dark 
                    group-hover:text-primary dark:group-hover:text-primary-text-dark">
                    Instant Queue
                  </span>
                  <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
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
          <div key={index} className="flex justify-between items-center p-3 
            bg-surface-alt dark:bg-surface-alt-dark 
            border border-border dark:border-border-dark rounded-lg">
            <div className="flex-1">
              <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
                {item.name}
              </span>
              {item.status === 'queued' && (
                <div className="flex gap-4 mt-2">
                  <select
                    value={item.seed}
                    onChange={(e) => updateItemOptions(index, { seed: Number(e.target.value) })}
                    className="text-xs bg-transparent border border-border dark:border-border-dark 
                      rounded text-primary-text dark:text-primary-text-dark"
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
                      className="mr-1 accent-accent dark:accent-accent-dark"
                    />
                    <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                      Zip
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={item.asQueued}
                      onChange={(e) => updateItemOptions(index, { asQueued: e.target.checked })}
                      className="mr-1 accent-accent dark:accent-accent-dark"
                    />
                    <span className="text-xs text-primary-text/70">Queue</span>
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
                <Spinner size="sm" className="text-yellow-500" />
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
          <div className="w-full bg-surface-alt dark:bg-surface-alt-dark rounded-full overflow-hidden">
            <div
              className="bg-accent dark:bg-accent-dark rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <div className="text-center text-sm text-primary-text/70 dark:text-primary-text-dark/70 mt-2">
            Uploading {progress.current} of {progress.total}
          </div>
        </div>
      )}

      {items.filter(item => item.status === 'queued').length > 0 && !uploading && (
        <div className="flex justify-end">
          <button
            onClick={uploadTorrents}
            disabled={uploading}
            className="mt-4 bg-accent hover:bg-accent/90 text-white text-sm px-6 py-2 mb-4 rounded-md
            transition-colors duration-200 disabled:bg-accent/90 disabled:cursor-not-allowed"
        >
            Upload {items.filter(item => item.status === 'queued').length} items
          </button>
        </div>
      )}

      {items.length > 0 && !items.some(item => item.status === 'queued' || item.status === 'processing') && (
        <div className="flex gap-4 items-center justify-end mt-4">
          <h3 className="text-sm text-primary-text dark:text-primary-text-dark/70">
            {items.filter(item => item.status === 'success').length} of {items.length} torrents processed
          </h3>

          <button
            onClick={handleDismiss}
            className="text-primary-text/70 hover:text-primary-text dark:text-primary-text-dark dark:hover:text-primary-text-dark/70"
            aria-label="Close panel"
          >
            Clear torrents
          </button>
        </div>
      )}
    </div>
  );
}