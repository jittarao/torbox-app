'use client';

export default function UploadProgress({ progress, uploading }) {
  if (!uploading) return null;

  const current = progress?.current || 0;
  const total = progress?.total || 0;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="mt-4">
      <div className="w-full bg-surface-alt dark:bg-surface-alt-dark rounded-full overflow-hidden">
        <div
          className="bg-accent dark:bg-accent-dark rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-center text-sm text-primary-text/70 dark:text-primary-text-dark/70 mt-2">
        Uploading {current} of {total}
      </div>
    </div>
  );
}
