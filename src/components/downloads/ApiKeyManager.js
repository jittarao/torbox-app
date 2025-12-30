'use client';

import { useState, useEffect } from 'react';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import { API_BASE } from '@/components/constants';

export default function ApiKeyManager({ onKeySelect, activeKey, onClose, keepOpen, onKeepOpenToggle }) {
  const t = useTranslations('ApiKeyManager');
  const [keys, setKeys] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('idle'); // idle, checking, valid, invalid

  useEffect(() => {
    fetchKeys();
  }, []);

  // Sync validation status when newKeyValue changes
  useEffect(() => {
    if (!newKeyValue) {
      setVerificationStatus('idle');
      return;
    }

    const verifyKey = async () => {
      const trimmedKey = newKeyValue.trim();
      if (!trimmedKey) {
        setVerificationStatus('idle');
        return;
      }

      setVerificationStatus('checking');
      try {
        const response = await fetch('/api/user/me', {
          headers: {
            'x-api-key': trimmedKey,
          },
        });

        if (response.ok) {
          setVerificationStatus('valid');
        } else {
          const data = await response.json().catch(() => ({}));
          console.error('Verification failed in manager:', data);
          setVerificationStatus('invalid');
        }
      } catch (error) {
        console.error('Verification network error in manager:', error);
        setVerificationStatus('invalid');
      }
    };

    const timer = setTimeout(verifyKey, 800);
    return () => clearTimeout(timer);
  }, [newKeyValue]);

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        const data = await response.json();
        setKeys(data);
      }
    } catch (error) {
      console.error('Error fetching API keys from server:', error);
    } finally {
      setLoading(false);
    }
  };

  const addKey = async () => {
    if (!newKeyLabel || !newKeyValue || verificationStatus !== 'valid') return;

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel, key: newKeyValue }),
      });

      if (response.ok) {
        const updatedKeys = await response.json();
        setKeys(updatedKeys);
        setNewKeyLabel('');
        setNewKeyValue('');
        setShowAddForm(false);
        setVerificationStatus('idle');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save key');
      }
    } catch (error) {
      console.error('Error adding API key:', error);
      alert('Failed to connect to server');
    }
  };

  const deleteKey = async (keyValue) => {
    try {
      const response = await fetch(`/api/keys?key=${encodeURIComponent(keyValue)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const updatedKeys = await response.json();
        setKeys(updatedKeys);

        // If we deleted the active key, switch to another one or go to landing
        if (keyValue === activeKey) {
          if (updatedKeys.length > 0) {
            // Select the first available key
            onKeySelect(updatedKeys[0].key);
          } else {
            // No keys left, clear active key to go to landing
            onKeySelect('');
          }
        }
      } else {
        alert('Failed to delete key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to connect to server');
    }
  };

  const handleLabelChange = (e) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
    setNewKeyLabel(value);
  };

  return (
    <div className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
          {t('savedKeys')} {loading && <span className="text-sm opacity-50 ml-2">(Loading...)</span>}
        </h3>
        <div className="flex gap-2">
          {/* Keep Manager Open Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer
                ${keepOpen
                  ? 'bg-accent dark:bg-accent-dark'
                  : 'bg-border dark:bg-border-dark'
                }`}
              onClick={() => onKeepOpenToggle(!keepOpen)}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${keepOpen ? 'translate-x-4' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm text-primary-text dark:text-primary-text-dark">
              {t('toggleOpen')}
            </span>
          </label>

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
            onClick={() => {
              if (keepOpen) return;
              onClose();
            }}
            className={`text-primary-text/70 dark:text-primary-text-dark/70 
              hover:text-primary-text dark:hover:text-primary-text-dark
              p-1.5 rounded-lg transition-colors ${keepOpen ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            aria-label={keepOpen ? 'Manager stays open' : t('close')}
            disabled={keepOpen}
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
                ${activeKey === keyItem.key
                  ? 'bg-accent/10 dark:bg-accent-dark/10 border border-accent dark:border-accent-dark'
                  : 'hover:bg-surface dark:hover:bg-surface-dark border border-transparent'
                }`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-2 h-2 rounded-full ${activeKey === keyItem.key
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
                onClick={() => deleteKey(keyItem.key)}
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
      ) : !loading && (
        <div className="text-center pb-4 text-primary-text/50 dark:text-primary-text-dark/50">
          {t('noKeys')}
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg w-full max-w-md shadow-2xl border border-border/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-primary-text dark:text-primary-text-dark uppercase tracking-wider">
                {t('addNewKey')}
              </h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2 text-primary-text/60 dark:text-primary-text-dark/60 uppercase tracking-widest">
                  {t('keyLabel')}
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={handleLabelChange}
                  placeholder={t('keyLabelPlaceholder')}
                  className="w-full px-4 py-3 border border-border/50 dark:border-border-dark/50 rounded-2xl
                    bg-surface-alt/50 dark:bg-surface-alt-dark/50 text-primary-text dark:text-primary-text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-primary-text/60 dark:text-primary-text-dark/60 uppercase tracking-widest">
                  {t('apiKey')}
                </label>
                <div className="relative group">
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    placeholder={t('apiKeyPlaceholder')}
                    className={`w-full px-4 py-3 pr-20 border rounded-2xl
                      bg-surface-alt/50 dark:bg-surface-alt-dark/50 text-primary-text dark:text-primary-text-dark focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono text-sm
                      ${verificationStatus === 'valid' ? 'border-green-500/50 focus:border-green-500' : verificationStatus === 'invalid' ? 'border-red-500/50 focus:border-red-500' : 'border-border/50 focus:border-primary'}
                    `}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowKeys(!showKeys)}
                      className="p-1.5 text-primary-text/40 hover:text-primary transition-colors"
                    >
                      {showKeys ? <Icons.Eye className="w-4 h-4" /> : <Icons.EyeOff className="w-4 h-4" />}
                    </button>

                    <div className="w-px h-4 bg-border/50 mx-1"></div>

                    {verificationStatus === 'checking' && (
                      <div className="animate-spin text-primary">
                        <Icons.Refresh className="w-4 h-4" />
                      </div>
                    )}
                    {verificationStatus === 'valid' && (
                      <div className="text-green-500 animate-in zoom-in duration-300">
                        <Icons.CheckCircle className="w-5 h-5 fill-green-500/10" />
                      </div>
                    )}
                    {verificationStatus === 'invalid' && (
                      <div className="text-red-500 animate-in shake duration-300">
                        <Icons.XCircle className="w-5 h-5 fill-red-500/10" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setVerificationStatus('idle');
                }}
                className="px-6 py-2.5 text-sm font-bold text-primary-text/60 dark:text-primary-text-dark/60
                  hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-xl transition-all"
              >
                {t('cancel')}
              </button>
              <button
                onClick={addKey}
                disabled={!newKeyLabel || !newKeyValue || verificationStatus !== 'valid'}
                className={`px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 shadow-lg
                  ${verificationStatus === 'valid' && newKeyLabel
                    ? 'bg-primary text-white hover:scale-105 active:scale-95 shadow-primary/20'
                    : 'bg-border/20 dark:bg-border-dark/20 text-primary-text/20 cursor-not-allowed shadow-none'
                  }
                `}
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
