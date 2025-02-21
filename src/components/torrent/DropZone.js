import { useDropzone } from 'react-dropzone';

export const DropZone = ({ onDrop, disabled }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    accept: '.torrent'
  });

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    onDrop(droppedFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (disabled) {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`border-2 border-dashed rounded-lg p-8 text-center h-40 
        flex items-center justify-center
        ${isDragActive 
          ? 'border-accent dark:border-accent-dark bg-accent/5 dark:bg-accent-dark/5' 
          : 'border-border dark:border-border-dark hover:border-accent/50 dark:hover:border-accent-dark/50'
        } 
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} 
        transition-colors`}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        Drop torrent files here, or click to select
      </p>
    </div>
  );
}; 