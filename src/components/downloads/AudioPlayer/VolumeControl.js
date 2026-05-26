'use client';

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function VolumeIcon({ displayVolume, className = 'w-5 h-5' }) {
  if (displayVolume === 0) {
    return (
      <svg className={className} {...svgProps}>
        <path d="M14 14.81V9.19C14 6.04 14 4.47 13.07 4.08C12.15 3.69 11.06 4.80 8.88 7.02C7.75 8.17 7.11 8.43 5.51 8.43C4.10 8.43 3.40 8.43 2.90 8.77C1.85 9.49 2.01 10.88 2.01 12C2.01 13.12 1.85 14.51 2.90 15.23C3.40 15.57 4.10 15.57 5.51 15.57C7.11 15.57 7.75 15.83 8.88 16.98C11.06 19.20 12.15 20.31 13.07 19.92C14 19.53 14 17.96 14 14.81Z" />
        <path d="M18 10L22 14M18 14L22 10" />
      </svg>
    );
  }
  if (displayVolume < 0.5) {
    return (
      <svg className={className} {...svgProps}>
        <path d="M19 9C19.63 9.82 20 10.86 20 12C20 13.14 19.63 14.18 19 15" />
        <path d="M16 14.81V9.19C16 6.04 16 4.47 15.07 4.08C14.15 3.69 13.06 4.80 10.88 7.02C9.75 8.17 9.11 8.43 7.51 8.43C6.10 8.43 5.40 8.43 4.90 8.77C3.85 9.49 4.01 10.88 4.01 12C4.01 13.12 3.85 14.51 4.90 15.23C5.40 15.57 6.10 15.57 7.51 15.57C9.11 15.57 9.75 15.83 10.88 16.98C13.06 19.20 14.15 20.31 15.07 19.92C16 19.53 16 17.96 16 14.81Z" />
      </svg>
    );
  }
  return (
    <svg className={className} {...svgProps}>
      <path d="M14 14.81V9.19C14 6.04 14 4.47 13.07 4.08C12.15 3.69 11.06 4.80 8.88 7.02C7.75 8.17 7.11 8.43 5.51 8.43C4.10 8.43 3.40 8.43 2.90 8.77C1.85 9.49 2.01 10.88 2.01 12C2.01 13.12 1.85 14.51 2.90 15.23C3.40 15.57 4.10 15.57 5.51 15.57C7.11 15.57 7.75 15.83 8.88 16.98C11.06 19.20 12.15 20.31 13.07 19.92C14 19.53 14 17.96 14 14.81Z" />
      <path d="M17 9C17.63 9.82 18 10.86 18 12C18 13.14 17.63 14.18 17 15" />
      <path d="M20 7C21.25 8.37 22 10.11 22 12C22 13.89 21.25 15.63 20 17" />
    </svg>
  );
}

export default function VolumeControl({
  volume,
  isMuted,
  showVolumeSlider,
  onToggle,
  onVolumeChange,
  onMuteToggle,
}) {
  const displayVolume = isMuted ? 0 : volume;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          onToggle();
        }}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
        aria-label={isMuted ? 'Unmute' : `Volume ${Math.round(displayVolume * 100)}%`}
      >
        <VolumeIcon displayVolume={displayVolume} />
        <span className="text-xs">Vol</span>
      </button>
      {showVolumeSlider && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onToggle(false)} aria-hidden />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 py-3 px-3 rounded-xl bg-[#0d1117] border border-white/10 shadow-xl z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onMuteToggle}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon displayVolume={displayVolume} />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(displayVolume * 100)}
                onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
                className="w-24 h-1.5 rounded-full appearance-none bg-white/20 accent-amber-500"
                aria-label="Volume"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
