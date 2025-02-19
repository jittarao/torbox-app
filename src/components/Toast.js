'use client';

export default function Toast({ message, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up">
      <span>{message}</span>
      <button 
        onClick={onClose}
        className="ml-2 text-gray-300 hover:text-white"
      >
        ×
      </button>
    </div>
  );
} 