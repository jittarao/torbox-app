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
        <path d="M14 14.8135V9.18646C14 6.04126 14 4.46866 13.0747 4.0773C12.1494 3.68593 11.0603 4.79793 8.88232 7.02192C7.75439 8.17365 7.11085 8.42869 5.50604 8.42869C4.10257 8.42869 3.40084 8.42869 2.89675 8.77262C1.85035 9.48655 2.00852 10.882 2.00852 12C2.00852 13.118 1.85035 14.5134 2.89675 15.2274C3.40084 15.5713 4.10257 15.5713 5.50604 15.5713C7.11085 15.5713 7.75439 15.8264 8.88232 16.9781C11.0603 19.2021 12.1494 20.3141 13.0747 19.9227C14 19.5313 14 17.9587 14 14.8135Z" />
        <path d="M18 10L22 14M18 14L22 10" />
      </svg>
    );
  }
  if (displayVolume < 0.5) {
    return (
      <svg className={className} {...svgProps}>
        <path d="M19 9C19.6254 9.81968 20 10.8634 20 12C20 13.1366 19.6254 14.1803 19 15" />
        <path d="M16 14.8135V9.18646C16 6.04126 16 4.46866 15.0747 4.0773C14.1494 3.68593 13.0604 4.79793 10.8823 7.02192C9.7544 8.17365 9.11086 8.42869 7.50605 8.42869C6.10259 8.42869 5.40086 8.42869 4.89677 8.77262C3.85036 9.48655 4.00854 10.882 4.00854 12C4.00854 13.118 3.85036 14.5134 4.89677 15.2274C5.40086 15.5713 6.10259 15.5713 7.50605 15.5713C9.11086 15.5713 9.7544 15.8264 10.8823 16.9781C13.0604 19.2021 14.1494 20.3141 15.0747 19.9227C16 19.5313 16 17.9587 16 14.8135Z" />
      </svg>
    );
  }
  return (
    <svg className={className} {...svgProps}>
      <path d="M14 14.8135V9.18646C14 6.04126 14 4.46866 13.0747 4.0773C12.1494 3.68593 11.0603 4.79793 8.88232 7.02192C7.75439 8.17365 7.11085 8.42869 5.50604 8.42869C4.10257 8.42869 3.40084 8.42869 2.89675 8.77262C1.85035 9.48655 2.00852 10.882 2.00852 12C2.00852 13.118 1.85035 14.5134 2.89675 15.2274C3.40084 15.5713 4.10257 15.5713 5.50604 15.5713C7.11085 15.5713 7.75439 15.8264 8.88232 16.9781C11.0603 19.2021 12.1494 20.3141 13.0747 19.9227C14 19.5313 14 17.9587 14 14.8135Z" />
      <path d="M17 9C17.6254 9.81968 18 10.8634 18 12C18 13.1366 17.6254 14.1803 17 15" />
      <path d="M20 7C21.2508 8.36613 22 10.1057 22 12C22 13.8943 21.2508 15.6339 20 17" />
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
