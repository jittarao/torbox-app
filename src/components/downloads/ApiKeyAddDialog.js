import { Eye, EyeOff, Times } from '@/components/icons';

export default function ApiKeyAddDialog({
  addDialogRef,
  t,
  tInput,
  newKeyLabel,
  setNewKeyLabel,
  newKeyValue,
  setNewKeyValue,
  showKeys,
  setShowKeys,
  onClose,
  onAdd,
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <dialog
        ref={addDialogRef}
        className="fixed top-1/2 left-1/2 z-[70] flex max-h-[min(90vh,28rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden
          rounded-xl border border-border/80 bg-surface shadow-xl
          dark:border-border-dark/80 dark:bg-surface-dark sm:w-full"
        aria-labelledby="api-key-add-dialog-title"
        aria-modal="true"
        open
      >
        <div onClick={(e) => e.stopPropagation()} className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 dark:border-border-dark/60">
            <h3
              id="api-key-add-dialog-title"
              className="text-sm font-medium text-primary-text dark:text-primary-text-dark"
            >
              {t('addNewKey')}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 h-7 w-7 flex items-center justify-center touch-manipulation
                text-primary-text/50 hover:text-primary-text hover:bg-surface-alt
                dark:text-primary-text-dark/50 dark:hover:text-primary-text-dark dark:hover:bg-surface-alt-dark"
              aria-label={t('close')}
            >
              <Times className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
            <div>
              <label
                htmlFor="api-key-label"
                className="mb-1 block text-xs font-medium text-primary-text dark:text-primary-text-dark"
              >
                {t('keyLabel')}
              </label>
              <input
                id="api-key-label"
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder={t('keyLabelPlaceholder')}
                className="w-full rounded-lg border border-border/80 bg-surface-alt/50 px-2.5 py-2 text-sm
                  text-primary-text placeholder:text-primary-text/40
                  focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/25
                  dark:border-border-dark/80 dark:bg-surface-alt-dark/50 dark:text-primary-text-dark
                  dark:placeholder:text-primary-text-dark/40 dark:focus:border-accent-dark dark:focus:ring-accent-dark/25"
                autoComplete="off"
              />
            </div>
            <div>
              <label
                htmlFor="api-key-value"
                className="mb-1 block text-xs font-medium text-primary-text dark:text-primary-text-dark"
              >
                {t('apiKey')}
              </label>
              <div className="relative">
                <input
                  id="api-key-value"
                  type={showKeys ? 'text' : 'password'}
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  className="w-full rounded-lg border border-border/80 bg-surface-alt/50 px-2.5 py-2 pr-9 text-sm font-mono
                    text-primary-text placeholder:text-primary-text/40
                    focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/25
                    dark:border-border-dark/80 dark:bg-surface-alt-dark/50 dark:text-primary-text-dark
                    dark:placeholder:text-primary-text-dark/40 dark:focus:border-accent-dark dark:focus:ring-accent-dark/25"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKeys(!showKeys)}
                  className="absolute right-0.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md touch-manipulation
                    text-primary-text/45 hover:text-primary-text dark:text-primary-text-dark/45 dark:hover:text-primary-text-dark"
                  aria-label={showKeys ? tInput('hide') : tInput('show')}
                >
                  {showKeys ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 p-3 dark:border-border-dark/60">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark
                hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors touch-manipulation"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={onAdd}
              disabled={!newKeyLabel || !newKeyValue}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-accent dark:bg-accent-dark
                hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors touch-manipulation
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('add')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
