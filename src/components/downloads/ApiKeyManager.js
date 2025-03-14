import { useState, useEffect } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function ApiKeyManager({ onKeySelect, activeKey, onClose }) {
  const t = useTranslations('ApiKeyManager');
  const [keys, setKeys] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    const storedKeys = localStorage.getItem('torboxApiKeys');
    if (storedKeys) {
      setKeys(JSON.parse(storedKeys));
    }
  }, []);

  const saveKeys = (newKeys) => {
    localStorage.setItem('torboxApiKeys', JSON.stringify(newKeys));
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

  const deleteKey = (index) => {
    const newKeys = keys.filter((_, i) => i !== index);
    saveKeys(newKeys);
  };

  return (
    <div className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
          {t('savedKeys')}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm bg-accent dark:bg-accent-dark text-white px-3 py-1.5 rounded-lg
              hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors
              flex items-center gap-1"
          >
            <Icons.Plus className="w-4 h-4" />
            {t('addKey')}
          </button>
          <button
            onClick={onClose}
            className="text-primary-text/70 dark:text-primary-text-dark/70 
              hover:text-primary-text dark:hover:text-primary-text-dark
              p-1.5 rounded-lg transition-colors"
            aria-label={t('close')}
            title={t('close')}
          >
            <Icons.Times className="w-5 h-5" />
          </button>
        </div>
      </div>

      {keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map((keyItem, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors
                ${
                  activeKey === keyItem.key
                    ? 'bg-accent/10 dark:bg-accent-dark/10 border border-accent dark:border-accent-dark'
                    : 'hover:bg-surface dark:hover:bg-surface-dark border border-transparent'
                }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activeKey === keyItem.key
                      ? 'bg-accent dark:bg-accent-dark'
                      : 'bg-primary-text/20 dark:bg-primary-text-dark/20'
                  }`}
                />
                <button
                  onClick={() => onKeySelect(keyItem.key)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-primary-text dark:text-primary-text-dark">
                    {keyItem.label}
                  </div>
                  <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 font-mono">
                    {keyItem.key.slice(0, 8)}...{keyItem.key.slice(-8)}
                  </div>
                </button>
              </div>
              <button
                onClick={() => deleteKey(index)}
                className="text-primary-text/50 hover:text-red-500 dark:text-primary-text-dark/50 
                  dark:hover:text-red-500 p-1 rounded transition-colors"
                aria-label={t('deleteKey')}
                title={t('deleteKey')}
              >
                <Icons.Delete className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center pb-4 text-primary-text/50 dark:text-primary-text-dark/50">
          {t('noKeys')}
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
                {t('addNewKey')}
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-primary-text dark:text-primary-text-dark">
                  {t('keyLabel')}
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder={t('keyLabelPlaceholder')}
                  className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg
                    bg-transparent text-primary-text dark:text-primary-text-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-primary-text dark:text-primary-text-dark">
                  {t('apiKey')}
                </label>
                <div className="relative">
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={t('apiKeyPlaceholder')}
                    className="w-full px-3 py-2 pr-10 border border-border dark:border-border-dark rounded-lg
                      bg-transparent text-primary-text dark:text-primary-text-dark"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(!showKeys)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-text/50 
                      dark:text-primary-text-dark/50 hover:text-primary-text 
                      dark:hover:text-primary-text-dark transition-colors p-1"
                  >
                    {showKeys ? <Icons.Eye /> : <Icons.EyeOff />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm text-primary-text dark:text-primary-text-dark
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={addKey}
                disabled={!newKeyLabel || !newKeyValue}
                className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg text-sm
                  hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
