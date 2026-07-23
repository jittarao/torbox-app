import { useState, useRef } from 'react';
import { Plus, Times } from '@/components/icons';
import { useTranslations } from 'next-intl';
import { ensureUserDb } from '@/utils/ensureUserDb';
import { useModalFocusTrap } from '@/components/shared/hooks/useModalFocusTrap';
import { getItem, setJSON } from '@/utils/storage';
import { ToggleSwitch } from './apiKeyManagerHelpers';
import ApiKeyList from './ApiKeyList';
import ApiKeyAddDialog from './ApiKeyAddDialog';

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

      <ApiKeyList
        keys={keys}
        activeKey={activeKey}
        compact={compact}
        textSm={textSm}
        rowPad={rowPad}
        t={t}
        onSelectKey={handleSelectKey}
        onDeleteKey={deleteKey}
        onShowAddForm={() => setShowAddForm(true)}
      />

      {showAddForm && (
        <ApiKeyAddDialog
          addDialogRef={addDialogRef}
          t={t}
          tInput={tInput}
          newKeyLabel={newKeyLabel}
          setNewKeyLabel={setNewKeyLabel}
          newKeyValue={newKeyValue}
          setNewKeyValue={setNewKeyValue}
          showKeys={showKeys}
          setShowKeys={setShowKeys}
          onClose={() => setShowAddForm(false)}
          onAdd={addKey}
        />
      )}
    </div>
  );
}
