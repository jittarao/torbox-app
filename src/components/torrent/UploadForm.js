'use client';
import { DropZone } from './DropZone';

export default function UploadForm({
  magnetInput,
  setMagnetInput,
  handleKeyDown,
  validateAndAddFiles,
  uploading,
  assetTypeInfo,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <textarea
          value={magnetInput}
          onChange={(e) => setMagnetInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => {
            setTimeout(() => setMagnetInput(e.target.value), 0);
          }}
          disabled={uploading}
          placeholder={assetTypeInfo.inputPlaceholder}
          className="w-full min-h-40 h-40 p-3 border border-border dark:border-border-dark rounded-lg 
            bg-transparent text-primary-text dark:text-primary-text-dark 
            placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
            focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
            focus:border-accent dark:focus:border-accent-dark
            disabled:bg-surface-alt dark:disabled:bg-surface-alt-dark 
            disabled:text-primary-text/50 dark:disabled:text-primary-text-dark/50
            transition-colors duration-200"
        />
      </div>

      {assetTypeInfo.showDropzone && (
        <div>
          <DropZone
            onDrop={validateAndAddFiles}
            disabled={uploading}
            acceptedFileTypes={assetTypeInfo.fileExtension}
            dropzoneText={assetTypeInfo.dropzoneText}
          />
        </div>
      )}
    </div>
  );
}
