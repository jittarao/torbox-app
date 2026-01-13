'use client';

import Icons from '@/components/icons';

/**
 * ErrorOverlay - Displays error message with retry option
 * @param {Object} props
 * @param {string} props.error - Error message to display
 * @param {Function} props.onRetry - Callback when retry button is clicked
 */
export default function ErrorOverlay({ error, onRetry }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-20">
      <div className="text-center px-6 max-w-md">
        <div className="inline-flex p-4 rounded-full bg-red-500/20 mb-4">
          <Icons.AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <p className="text-lg font-medium text-white mb-2">{error}</p>
        <p className="text-sm text-white/70 mb-4">
          Please try again or check your connection.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-lg bg-accent dark:bg-accent-dark 
              text-white hover:bg-accent/90 dark:hover:bg-accent-dark/90 
              transition-colors text-sm font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
