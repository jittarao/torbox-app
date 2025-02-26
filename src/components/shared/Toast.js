'use client';

import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg
      ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} 
      text-white`}
    >
      {message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
