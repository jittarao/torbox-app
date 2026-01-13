'use client';

/**
 * TrackSelector - Dropdown menu for selecting audio or subtitle tracks
 * @param {Object} props
 * @param {string} props.type - 'audio' or 'subtitle'
 * @param {Array} props.tracks - Array of track objects
 * @param {number|null} props.selectedIndex - Currently selected track index (null for subtitles off)
 * @param {boolean} props.isOpen - Whether menu is open
 * @param {Function} props.onSelect - Callback when track is selected
 * @param {Function} props.onToggle - Callback to toggle menu
 * @param {Object} props.menuRef - Ref for the menu container
 */
export default function TrackSelector({
  type,
  tracks,
  selectedIndex,
  isOpen,
  onSelect,
  onToggle,
  menuRef,
}) {
  const isAudio = type === 'audio';
  const hasTracks = tracks && tracks.length > 0;

  if (!hasTracks) return null;

  const Icon = isAudio ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M2 10v3" />
      <path d="M6 6v11" />
      <path d="M10 3v18" />
      <path d="M14 8v7" />
      <path d="M18 5v13" />
      <path d="M22 10v3" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 20V4h18v16H3Zm1.5 -1.5h15V5.5H4.5v13Zm1.5 -3.525h5.05v-1.8h-1.25v0.55h-2.55v-3.45h2.55v0.55h1.25v-1.8H6v5.95Zm6.975 0h5.05v-1.8h-1.25v0.55h-2.55v-3.45h2.55v0.55h1.25v-1.8h-5.05v5.95Z" />
    </svg>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(e);
        }}
        className="p-2 rounded-full bg-white/10 hover:bg-white/20 
          backdrop-blur-sm text-white transition-all duration-200
          hover:scale-110 active:scale-95"
        aria-label={isAudio ? 'Audio Tracks' : 'Subtitles'}
      >
        {Icon}
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
          <div className="p-2 text-xs text-white/70 px-3 py-2 border-b border-white/10">
            {isAudio ? 'Audio Tracks' : 'Subtitle Tracks'}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {!isAudio && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                }}
                className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors ${
                  selectedIndex === null ? 'bg-accent/20' : ''
                }`}
              >
                Off
              </button>
            )}
            {tracks.map((track, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(idx);
                }}
                className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors ${
                  selectedIndex === idx ? 'bg-accent/20' : ''
                }`}
              >
                {track.language_full || track.language || `Track ${idx + 1}`}
                {track.default && <span className="ml-2 text-xs text-white/60">(Default)</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
