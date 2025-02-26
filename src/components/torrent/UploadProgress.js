'use client';

export default function UploadProgress({ progress, uploading }) {
  if (!uploading) return null;

  return (
    <div className="mt-4">
      <div className="w-full bg-surface-alt dark:bg-surface-alt-dark rounded-full overflow-hidden">
        <div
          className="bg-accent dark:bg-accent-dark rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        ></div>
      </div>
      <div className="text-center text-sm text-primary-text/70 dark:text-primary-text-dark/70 mt-2">
        Uploading {progress.current} of {progress.total}
      </div>
    </div>
  );
}
