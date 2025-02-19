'use client';
import { useState, useEffect } from 'react';

export default function ApiKeyInput({ onKeyChange }) {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
      onKeyChange(storedKey);
    }
  }, []);

  const handleKeyChange = (e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
    onKeyChange(newKey);
  };

  return (
    <div className="mb-4">
      <input
        type="password"
        value={apiKey}
        onChange={handleKeyChange}
        placeholder="Enter Torbox API Key"
        className="w-full p-2 border rounded"
      />
    </div>
  );
} 