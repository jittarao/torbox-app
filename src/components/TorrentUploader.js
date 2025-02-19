'use client';
import { useState, useRef } from 'react';

export default function TorrentUploader({ apiKey }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const dropZoneRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    validateAndAddFiles(selectedFiles);
  };

  const validateAndAddFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => file.name.endsWith('.torrent'));
    const totalFiles = files.length + validFiles.length;
    
    if (totalFiles > 50) {
      setError('Maximum 50 files allowed');
      return;
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    setError('');
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    setUploading(true);
    setProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);

      try {
        await fetch('/api/torrents', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey
          },
          body: formData
        });
        setProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    setUploading(false);
    setFiles([]);
  };

  return (
    <div className="mt-4">
      <div
        ref={dropZoneRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed p-4 text-center"
      >
        <input
          type="file"
          multiple
          accept=".torrent"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="fileInput"
        />
        <label htmlFor="fileInput" className="cursor-pointer">
          Drop .torrent files here or click to select
        </label>
      </div>

      {error && <div className="text-red-500 mt-2">{error}</div>}

      {uploading && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded">
            <div
              className="bg-blue-500 rounded h-2"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <div className="text-center">
            Uploading {progress.current} of {progress.total}
          </div>
        </div>
      )}

      <div className="mt-2">
        {files.map((file, index) => (
          <div key={index} className="flex justify-between items-center">
            <span>{file.name}</span>
            <button
              onClick={() => removeFile(index)}
              disabled={uploading}
              className="text-red-500"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {files.length > 0 && (
        <button
          onClick={uploadFiles}
          disabled={uploading}
          className="mt-2 bg-blue-500 text-white px-4 py-2 rounded"
        >
          Upload {files.length} files
        </button>
      )}
    </div>
  );
} 