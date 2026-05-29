import { useState, useRef } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import { ensureUserDb } from '@/utils/ensureUserDb';
import { useModalFocusTrap } from '@/components/shared/hooks/useModalFocusTrap';

export default function ApiKeyManager({
  onKeySelect,
  activeKey,
  onClose,
  keepOpen,
  onKeepOpenToggle,
  compact = false,
}) {
  const t = useTranslations('ApiKeyManager');
  const tInput = useTranslations('ApiKeyInput');
  const [keys, setKeys] = useState(() => {
    try {
      const storedKeys =
        localStorage.getItem('torboxApiKeys:v1') ?? localStorage.getItem('torboxApiKeys');
      return storedKeys ? JSON.parse(storedKeys) : [];
    } catch (error) {
      console.error('Error parsing API keys from localStorage:', error);
      return [];
    }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const addDialogRef = useRef(null);
  useModalFocusTrap(showAddForm, addDialogRef);

  const saveKeys = (newKeys) => {
    localStorage.setItem('torboxApiKeys:v1', JSON.stringify(newKeys));
    setKeys(newKeys);
  };

  const addKey = () => {
    if (!newKeyLabel || !newKeyValue) return;
    const newKeys = [...keys, { label: newKeyLabel, key: newKeyValue }];
    saveKeys(newKeys);
    setNewKeyLabel('');
    setNewKeyValue('');
    setShowAddForm(false);
  };

  const deleteKey = (keyToDelete) => {
    const newKeys = keys.filter((k) => k.key !== keyToDelete);
    saveKeys(newKeys);
  };

  const closeDisabled = keepOpen;

  return (
    <div
      className={`min-w-0 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark ${compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-4'}`}
    >
      <div
        className={`flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${compact ? 'mb-2.5' : 'mb-3 sm:mb-4'}`}
      >
        <h3
          className={`shrink-0 ${compact ? 'text-sm' : 'text-base sm:text-lg'} font-medium text-primary-text dark:text-primary-text-dark`}
        >
          {t('savedKeys')}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end">
          {/* Keep Manager Open Toggle */}
          <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer touch-manipulation min-h-9 px-0.5">
            <div
              role="switch"
              aria-checked={keepOpen}
              aria-label={t('toggleOpen')}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onKeepOpenToggle(!keepOpen);
                }
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer
                ${keepOpen ? 'bg-accent dark:bg-accent-dark' : 'bg-border dark:bg-border-dark'}`}
              onClick={() => onKeepOpenToggle(!keepOpen)}
            >
              <span
                className={`inline-block size-4 transform rounded-full bg-white transition-transform
                  ${keepOpen ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </div>
            <span className="hidden sm:inline text-sm text-primary-text dark:text-primary-text-dark">
              {t('toggleOpen')}
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-sm bg-accent dark:bg-accent-dark text-white px-2.5 sm:px-3 py-1.5 rounded-lg min-h-9
              hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors touch-manipulation
              flex items-center gap-1"
            aria-label={t('addKey')}
          >
            <Icons.Plus className="size-4 shrink-0" />
            <span className={compact ? 'hidden min-[400px]:inline' : 'hidden sm:inline'}>
              {t('addKey')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (closeDisabled) return;
              onClose();
            }}
            className={`text-primary-text/70 dark:text-primary-text-dark/70 
              hover:text-primary-text dark:hover:text-primary-text-dark
              p-2 rounded-lg transition-colors touch-manipulation min-h-9 min-w-9 flex items-center justify-center ${
                closeDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            aria-label={closeDisabled ? 'Manager stays open' : t('close')}
            title={
              closeDisabled ? 'Manager stays open - disable "Toggle Open" to close' : t('close')
            }
            disabled={closeDisabled}
          >
            <Icons.Times className="size-5" />
          </button>
        </div>
      </div>

      {keys.length > 0 ? (
        <div className="space-y-1.5 sm:space-y-2 max-h-[min(40vh,20rem)] sm:max-h-none overflow-y-auto overscroll-contain -mx-0.5 px-0.5">
          {keys.map((keyItem) => (
            <div
              key={keyItem.key}
              className={`flex items-center gap-2 justify-between rounded-lg transition-colors min-w-0
                ${compact ? 'p-2' : 'p-2.5 sm:p-3'}
                ${
                  activeKey === keyItem.key
                    ? 'bg-accent/10 dark:bg-accent-dark/10 border border-accent dark:border-accent-dark'
                    : 'hover:bg-surface dark:hover:bg-surface-dark border border-transparent'
                }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div
                  className={`shrink-0 size-2 rounded-full ${
                    activeKey === keyItem.key
                      ? 'bg-accent dark:bg-accent-dark'
                      : 'bg-primary-text/20 dark:bg-primary-text-dark/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const result = await ensureUserDb(keyItem.key);
                    if (result.success && result.wasCreated) {
                      console.log('User database created for API key');
                    }

                    onKeySelect(keyItem.key);
                  }}
                  className="flex-1 min-w-0 text-left touch-manipulation"
                >
                  <div
                    className={`font-medium text-primary-text dark:text-primary-text-dark truncate ${compact ? 'text-sm' : ''}`}
                  >
                    {keyItem.label}
                  </div>
                  <div
                    className={`text-primary-text/70 dark:text-primary-text-dark/70 font-mono truncate ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
                  >
                    {keyItem.key.slice(0, 8)}...{keyItem.key.slice(-8)}
                  </div>
                </button>
              </div>
              <button
                type="button"
                onClick={() => deleteKey(keyItem.key)}
                className="shrink-0 text-primary-text/50 hover:text-red-500 dark:text-primary-text-dark/50 
                  dark:hover:text-red-500 p-2 -mr-1 rounded-lg transition-colors touch-manipulation min-h-9 min-w-9 flex items-center justify-center"
                aria-label={t('deleteKey')}
                title={t('deleteKey')}
              >
                <Icons.Delete className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={`text-center text-primary-text/50 dark:text-primary-text-dark/50 ${compact ? 'py-2 text-sm' : 'pb-3 sm:pb-4 text-sm sm:text-base'}`}
        >
          {t('noKeys')}
        </div>
      )}

      {showAddForm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowAddForm(false)}
            aria-hidden
          />
          <dialog
            ref={addDialogRef}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
              bg-surface dark:bg-surface-dark
              border border-border dark:border-border-dark
              rounded-lg shadow-xl
              w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[min(90vh,32rem)]
              overflow-hidden flex flex-col"
            aria-labelledby="api-key-add-dialog-title"
            aria-modal="true"
            open
          >
            <div onClick={(e) => e.stopPropagation()} className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-3 p-4 sm:p-6 pb-0 sm:pb-0 shrink-0">
                <h3
                  id="api-key-add-dialog-title"
                  className="text-base sm:text-lg font-medium text-primary-text dark:text-primary-text-dark"
                >
                  {t('addNewKey')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-2 -mr-1 rounded-lg min-h-9 min-w-9 flex items-center justify-center touch-manipulation
                  text-primary-text/70 dark:text-primary-text-dark/70
                  hover:text-primary-text dark:hover:text-primary-text-dark
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors"
                  aria-label={t('close')}
                >
                  <Icons.Times className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 pt-4 space-y-4">
                <div>
                  <label
                    htmlFor="api-key-label"
                    className="block text-sm font-medium mb-1 text-primary-text dark:text-primary-text-dark"
                  >
                    {t('keyLabel')}
                  </label>
                  <input
                    id="api-key-label"
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder={t('keyLabelPlaceholder')}
                    className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-border dark:border-border-dark rounded-lg
                    bg-transparent text-primary-text dark:text-primary-text-dark"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label
                    htmlFor="api-key-value"
                    className="block text-sm font-medium mb-1 text-primary-text dark:text-primary-text-dark"
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
                      className="w-full px-3 py-2.5 sm:py-2 pr-11 text-base sm:text-sm border border-border dark:border-border-dark rounded-lg
                      bg-transparent text-primary-text dark:text-primary-text-dark"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys(!showKeys)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-primary-text/50 
                      dark:text-primary-text-dark/50 hover:text-primary-text 
                      dark:hover:text-primary-text-dark transition-colors p-2 touch-manipulation min-h-9 min-w-9 flex items-center justify-center"
                      aria-label={showKeys ? tInput('hide') : tInput('show')}
                    >
                      {showKeys ? (
                        <Icons.Eye className="size-4" />
                      ) : (
                        <Icons.EyeOff className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-4 sm:p-6 pt-0 shrink-0 border-t border-border/60 dark:border-border-dark/60 sm:border-0">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-primary-text dark:text-primary-text-dark
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-lg transition-colors touch-manipulation min-h-10"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={addKey}
                  disabled={!newKeyLabel || !newKeyValue}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-accent dark:bg-accent-dark text-white rounded-lg text-sm
                  hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors touch-manipulation min-h-10
                  disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('add')}
                </button>
              </div>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
