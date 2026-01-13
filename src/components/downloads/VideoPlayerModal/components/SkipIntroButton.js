'use client';

/**
 * SkipIntroButton - Netflix-style skip intro button
 * @param {Object} props
 * @param {Function} props.onSkip - Callback when skip button is clicked
 */
export default function SkipIntroButton({ onSkip }) {
  return (
    <div className="absolute bottom-24 right-6 z-30">
      <button
        onClick={onSkip}
        className="px-6 py-3 rounded-lg bg-black/80 hover:bg-black/90 
          backdrop-blur-md text-white font-medium
          border border-white/20 transition-all duration-200
          hover:scale-105 active:scale-95
          flex items-center gap-2 shadow-lg"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 4l8 8-8 8V4zm10 0v16h2V4h-2z" />
        </svg>
        <span>Skip Intro</span>
      </button>
    </div>
  );
}
