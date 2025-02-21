'use client';

export default function Toast({ message, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 bg-primary dark:bg-surface-alt-dark text-white px-6 py-3 rounded-lg 
      flex items-center gap-2 animate-slide-up">
      <span>{message}</span>
      <button 
        onClick={onClose}
        className="ml-2 text-white/70 hover:text-white transition-colors"
      >
        ×
      </button>
    </div>
  );
} 