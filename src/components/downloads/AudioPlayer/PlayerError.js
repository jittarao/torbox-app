'use client';

export default function PlayerError({ errorMessage, onRetry, showRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
      <p className="text-center text-gray-400">{errorMessage || 'Playback error'}</p>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-full bg-amber-500/90 hover:bg-amber-500 text-gray-900 font-medium"
        >
          Retry
        </button>
      )}
    </div>
  );
}
