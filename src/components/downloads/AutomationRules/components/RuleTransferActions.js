'use client';

const ACTION_CLASS =
  'shrink-0 inline-flex items-center gap-1 text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export default function RuleTransferActions({
  canExport,
  busy,
  fileInputRef,
  onExport,
  onImportClick,
  onImportFile,
  t,
}) {
  const isBusy = busy !== null;

  return (
    <>
      {canExport && (
        <button
          type="button"
          onClick={onExport}
          disabled={isBusy}
          title={t('transfer.exportTitle')}
          className={ACTION_CLASS}
        >
          {busy === 'export' ? t('transfer.exporting') : t('transfer.export')}
        </button>
      )}
      <button
        type="button"
        onClick={onImportClick}
        disabled={isBusy}
        title={t('transfer.importTitle')}
        className={ACTION_CLASS}
      >
        {busy === 'import' ? t('transfer.importing') : t('transfer.import')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onImportFile}
      />
    </>
  );
}
