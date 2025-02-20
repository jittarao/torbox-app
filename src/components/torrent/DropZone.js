export const DropZone = ({ onDrop, disabled }) => {
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
      className={`border-2 border-dashed p-4 text-center h-40 flex items-center justify-center ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <input
        type="file"
        multiple
        accept=".torrent"
        onChange={(e) => onDrop(Array.from(e.target.files))}
        disabled={disabled}
        className="hidden"
        id="fileInput"
      />
      <label 
        htmlFor="fileInput" 
        className={`${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        Drop .torrent files here or click to select
      </label>
    </div>
  );
}; 