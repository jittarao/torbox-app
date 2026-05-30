import { useState, useRef } from 'react';
import { Check, Delete, Eye, EyeOff, Plus, Times } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { ensureUserDb } from '@/utils/ensureUserDb';
import { useModalFocusTrap } from '@/components/shared/hooks/useModalFocusTrap';
import { getItem, setJSON } from '@/utils/storage';

function getKeyInitials(label) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (label.trim().slice(0, 2) || '?').toUpperCase();
}

function maskApiKey(key) {
  if (key.length <= 16) return key;
  return `${key.slice(0, 6)}…${key.slice(-6)}`;
}

function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors touch-manipulation
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40
        ${checked ? 'bg-accent dark:bg-accent-dark' : 'bg-border/80 dark:bg-border-dark/80'}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

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
    const storedKeys = getItem('torboxApiKeys:v1') ?? getItem('torboxApiKeys');
    if (!storedKeys) return [];
    try {
      const parsed = JSON.parse(storedKeys);
      return Array.isArray(parsed) ? parsed : [];
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
    setJSON('torboxApiKeys:v1', newKeys);
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
  const keyCountLabel = t('keysCount', { count: keys.length });

  const handleSelectKey = async (keyItem) => {
    const result = await ensureUserDb(keyItem.key);
    if (result.success && result.wasCreated) {
      console.log('User database created for API key');
    }
    onKeySelect(keyItem.key);
  };

  const textSm = compact ? 'text-xs' : 'text-sm';
  const rowPad = compact ? 'px-1.5 py-1' : 'px-2 py-1.5';

  return (
    <div
      className={`min-w-0 rounded-lg border border-border/70 bg-surface-alt/50 dark:border-border-dark/70 dark:bg-surface-alt-dark/40
        ${compact ? 'p-2' : 'p-2.5'}`}
    >
      {/* Header + actions — single row */}
      <div className="flex items-center gap-2 min-w-0 mb-1.5">
        <div className={`min-w-0 flex-1 ${textSm}`}>
          <h3 className="font-medium text-primary-text dark:text-primary-text-dark truncate leading-tight">
            {t('savedKeys')}
          </h3>
          <p className="text-[10px] leading-tight text-primary-text/50 dark:text-primary-text-dark/50 truncate">
            {keyCountLabel}
          </p>
        </div>

        <label
          className="flex shrink-0 items-center gap-1.5 cursor-pointer touch-manipulation"
          title={t('toggleOpen')}
        >
          <span className="sr-only">{t('toggleOpen')}</span>
          <ToggleSwitch
            checked={keepOpen}
            onChange={onKeepOpenToggle}
            ariaLabel={t('toggleOpen')}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="shrink-0 inline-flex items-center justify-center gap-1 rounded-md bg-accent dark:bg-accent-dark text-white
            hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors touch-manipulation
            h-7 px-2 text-xs font-medium min-w-7"
          aria-label={t('addKey')}
          title={t('addKey')}
        >
          <Plus className="size-3.5 shrink-0" />
          <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{t('addKey')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (closeDisabled) return;
            onClose();
          }}
          className={`shrink-0 rounded-md p-1 text-primary-text/45 hover:text-primary-text hover:bg-surface-alt
            dark:text-primary-text-dark/45 dark:hover:text-primary-text-dark dark:hover:bg-surface-alt-dark
            transition-colors touch-manipulation h-7 w-7 flex items-center justify-center
            ${closeDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          aria-label={closeDisabled ? t('managerPinned') : t('close')}
          title={closeDisabled ? t('managerPinned') : t('close')}
          disabled={closeDisabled}
        >
          <Times className="size-4" />
        </button>
      </div>

      {/* Key list */}
      {keys.length > 0 ? (
        <ul
          className="flex flex-col gap-0.5 max-h-[min(28vh,11rem)] overflow-y-auto overscroll-contain"
          role="list"
        >
          {keys.map((keyItem) => {
            const isActive = activeKey === keyItem.key;
            return (
              <li key={keyItem.key} className="min-w-0">
                <div
                  className={`group flex items-center gap-1.5 rounded-md border min-w-0 ${rowPad}
                    ${
                      isActive
                        ? 'border-accent/40 bg-surface-alt-selected dark:border-accent-dark/40 dark:bg-surface-alt-selected-dark'
                        : 'border-transparent hover:border-border/60 hover:bg-surface-alt dark:hover:border-border-dark/60 dark:hover:bg-surface-alt-dark'
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectKey(keyItem)}
                    className="flex flex-1 items-center gap-1.5 min-w-0 text-left touch-manipulation rounded
                      focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 dark:focus-visible:ring-accent-dark/40"
                  >
                    <span
                      className={`flex shrink-0 items-center justify-center size-6 rounded font-semibold text-[9px] uppercase
                        ${
                          isActive
                            ? 'bg-accent text-white dark:bg-accent-dark'
                            : 'bg-surface dark:bg-surface-dark text-primary-text/60 dark:text-primary-text-dark/60 ring-1 ring-border/50 dark:ring-border-dark/50'
                        }`}
                      aria-hidden
                    >
                      {getKeyInitials(keyItem.label)}
                    </span>

                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="flex items-center gap-1 min-w-0">
                        <span
                          className={`font-medium truncate text-primary-text dark:text-primary-text-dark ${compact ? 'text-xs' : 'text-sm'}`}
                        >
                          {keyItem.label}
                        </span>
                        {isActive && (
                          <Check
                            className="size-3 shrink-0 text-accent dark:text-accent-dark"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span
                        className={`block font-mono truncate text-primary-text/45 dark:text-primary-text-dark/45 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
                      >
                        {maskApiKey(keyItem.key)}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteKey(keyItem.key)}
                    className="shrink-0 rounded p-1 text-primary-text/40 hover:text-red-500 hover:bg-red-500/10
                      dark:text-primary-text-dark/40 dark:hover:text-red-400 transition-colors touch-manipulation
                      h-7 w-7 flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    aria-label={t('deleteKey')}
                    title={t('deleteKey')}
                  >
                    <Delete className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p
          className={`text-center text-primary-text/45 dark:text-primary-text-dark/45 leading-snug ${compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'}`}
        >
          {t('noKeys')}{' '}
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-accent dark:text-accent-dark hover:underline touch-manipulation font-medium"
          >
            {t('addKey')}
          </button>
        </p>
      )}

      {/* Add key dialog — unchanged logic, slightly tighter */}
      {showAddForm && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowAddForm(false)}
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
                  onClick={() => setShowAddForm(false)}
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
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark
                    hover:bg-surface-alt dark:hover:bg-surface-alt-dark transition-colors touch-manipulation"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={addKey}
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
      )}
    </div>
  );
}
