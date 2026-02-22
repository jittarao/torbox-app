'use client';

export default function PlayerHeader({ fileName, onClose }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 shrink-0">
      <button
        type="button"
        onClick={onClose}
        className="p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <h1 className="text-sm font-medium text-gray-400 truncate max-w-[60%]">
        {fileName || 'Audio'}
      </h1>
      <div className="w-9" />
    </header>
  );
}
