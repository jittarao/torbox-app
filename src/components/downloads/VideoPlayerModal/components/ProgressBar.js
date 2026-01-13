'use client';

/**
 * ProgressBar - Video progress bar with seeking capability
 * @param {Object} props
 * @param {number} props.progress - Progress percentage (0-100)
 * @param {boolean} props.isSeeking - Whether user is currently seeking
 * @param {Function} props.onSeek - Callback when user clicks on progress bar
 * @param {Function} props.onSeekStart - Callback when user starts dragging
 */
export default function ProgressBar({ progress, isSeeking, onSeek, onSeekStart }) {
  return (
    <div 
      data-seekbar
      className="w-full h-1.5 bg-white/20 cursor-pointer group pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        onSeek(e);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSeekStart(e);
      }}
    >
      <div 
        className="h-full bg-accent dark:bg-accent-dark transition-all duration-150
          group-hover:bg-accent/90 dark:group-hover:bg-accent-dark/90
          relative pointer-events-none"
        style={{ width: `${progress}%` }}
      >
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2
          w-3 h-3 rounded-full bg-accent dark:bg-accent-dark
          transition-opacity pointer-events-none ${isSeeking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      </div>
    </div>
  );
}
