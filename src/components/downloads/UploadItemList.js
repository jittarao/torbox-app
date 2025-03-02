'use client';
import Spinner from '../shared/Spinner';

export default function UploadItemList({
  items,
  setItems,
  uploading,
  activeType,
}) {
  if (items.length === 0) return null;

  const showItemOptions = activeType === 'torrents';

  return (
    <div className="mt-4 space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex justify-between items-center p-3 
          bg-surface-alt dark:bg-surface-alt-dark 
          border border-border dark:border-border-dark rounded-lg"
        >
          <div className="flex-1">
            <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark">
              {item.name}
            </span>
            {item.status === 'error' && item.error && (
              <p className="text-xs text-red-500 mt-1">{item.error}</p>
            )}
            {item.status === 'queued' && showItemOptions && (
              <div className="flex gap-4 mt-2">
                <select
                  value={item.seed}
                  onChange={(e) => {
                    const updatedItems = items.map((i, idx) =>
                      idx === index
                        ? { ...i, seed: Number(e.target.value) }
                        : i,
                    );
                    setItems(updatedItems);
                  }}
                  className="text-xs bg-transparent border border-border dark:border-border-dark 
                    rounded text-primary-text dark:text-primary-text-dark"
                >
                  <option value={1}>Auto (Default)</option>
                  <option value={2}>Seed</option>
                  <option value={3}>Don't Seed</option>
                </select>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={item.allowZip}
                    onChange={(e) => {
                      const updatedItems = items.map((i, idx) =>
                        idx === index
                          ? { ...i, allowZip: e.target.checked }
                          : i,
                      );
                      setItems(updatedItems);
                    }}
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
                    onChange={(e) => {
                      const updatedItems = items.map((i, idx) =>
                        idx === index
                          ? { ...i, asQueued: e.target.checked }
                          : i,
                      );
                      setItems(updatedItems);
                    }}
                    className="mr-1 accent-accent dark:accent-accent-dark"
                  />
                  <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                    Queue
                  </span>
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {item.status === 'queued' && !uploading && (
              <button
                onClick={() => {
                  const updatedItems = items.filter((_, idx) => idx !== index);
                  setItems(updatedItems);
                }}
                className="text-red-500 hover:text-red-600 transition-colors duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            )}
            {item.status === 'success' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-green-500"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            {item.status === 'error' && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-red-500"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            )}
            {item.status === 'processing' && (
              <Spinner size="sm" className="text-yellow-500" />
            )}
            {item.status === 'queued' && uploading && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
