'use client';
import { useState, useRef } from 'react';
import Icons from '@/components/icons';

export function DropZone({
  onDrop,
  disabled = false,
  acceptedFileTypes = '.torrent, .nzb',
  dropzoneText = 'Drop torrent files here',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  const handleFileInputChange = (e) => {
    if (disabled) return;
    const files = Array.from(e.target.files);
    onDrop(files);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-6 h-40 flex flex-col items-center justify-center
        transition-colors duration-200 cursor-pointer
        ${
          isDragging
            ? 'border-accent dark:border-accent-dark bg-accent/5 dark:bg-accent-dark/5'
            : 'border-border dark:border-border-dark hover:border-accent/50 dark:hover:border-accent-dark/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        multiple
        accept={acceptedFileTypes}
        disabled={disabled}
      />
      <div className="text-accent dark:text-accent-dark mb-4">
        <Icons.Upload />
      </div>
      <p className="text-center text-primary-text/70 dark:text-primary-text-dark/70 text-sm">
        {dropzoneText}
      </p>
      <p className="text-center text-primary-text/50 dark:text-primary-text-dark/50 text-xs mt-1">
        or click to browse
      </p>
    </div>
  );
}
