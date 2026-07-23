'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import {
  folderWatcherSupportsMultiRule,
  hasFeature,
  type FolderWatcherConfig,
  type WatchRule,
} from '@/desktop/capabilities';
import {
  createDefaultWatchRule,
  DEFAULT_WATCHER_CONFIG,
} from '@/components/desktop/desktopFolderWatcherDefaults';

type UseDesktopFolderWatcherPanelOptions = {
  hasCredential: boolean;
  setToast?: (toast: { message: string; type: string }) => void;
};

export function useDesktopFolderWatcherPanel({
  hasCredential,
  setToast,
}: UseDesktopFolderWatcherPanelOptions) {
  const t = useTranslations('Desktop.folderWatcher');
  const { capabilities } = useDesktopCapabilities();
  const watcherConfig = useDesktopStore((state) => state.watcherConfig);
  const watcherStatus = useDesktopStore((state) => state.watcherStatus);
  const pickFolder = useDesktopStore((state) => state.pickFolder);
  const pickMoveDestinationFolder = useDesktopStore((state) => state.pickMoveDestinationFolder);
  const saveWatcherConfig = useDesktopStore((state) => state.saveWatcherConfig);
  const startWatcher = useDesktopStore((state) => state.startWatcher);
  const stopWatcher = useDesktopStore((state) => state.stopWatcher);

  const [draft, setDraft] = useState<FolderWatcherConfig>(DEFAULT_WATCHER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [pickingWatchRuleId, setPickingWatchRuleId] = useState<string | null>(null);
  const [pickingMoveRuleId, setPickingMoveRuleId] = useState<string | null>(null);
  const [scanConfirmRuleId, setScanConfirmRuleId] = useState<string | null>(null);
  const [changeFolderRuleId, setChangeFolderRuleId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(() => new Set());

  const canUseWatcher = hasFeature(capabilities, 'folderWatcher');
  const supportsMultiRule = folderWatcherSupportsMultiRule(capabilities);
  const canPickFolder = hasFeature(capabilities, 'folderPicker');
  const canUpload = hasFeature(capabilities, 'backgroundUploads');
  const maxRules = capabilities?.features?.folderWatcher?.maxRules ?? 10;

  useEffect(() => {
    if (watcherConfig) {
      setDraft(watcherConfig);
      if (watcherConfig.rules.length === 0) {
        setExpandedRuleIds(new Set());
      } else if (watcherConfig.rules.length === 1) {
        setExpandedRuleIds(new Set([watcherConfig.rules[0].id]));
      }
    }
  }, [watcherConfig]);

  const notify = useCallback(
    (message: string, type: 'success' | 'error') => {
      setToast?.({ message, type });
    },
    [setToast]
  );

  const persistDraft = useCallback(
    async (nextDraft: FolderWatcherConfig) => {
      setSaving(true);
      try {
        const ok = await saveWatcherConfig(nextDraft);
        if (!ok) {
          notify(t('saveFailed'), 'error');
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
      } finally {
        setSaving(false);
      }
    },
    [notify, saveWatcherConfig, t]
  );

  const updateRule = useCallback(
    async (ruleId: string, partial: Partial<WatchRule>) => {
      const nextDraft = {
        rules: draft.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...partial } : rule)),
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft);
    },
    [draft.rules, persistDraft]
  );

  const removeRule = useCallback(
    async (ruleId: string) => {
      const nextDraft = {
        rules: draft.rules.filter((rule) => rule.id !== ruleId),
      };
      setDraft(nextDraft);
      setExpandedRuleIds((current) => {
        const next = new Set(current);
        next.delete(ruleId);
        return next;
      });
      await persistDraft(nextDraft);
    },
    [draft.rules, persistDraft]
  );

  const addRule = useCallback(async () => {
    if (draft.rules.length >= maxRules) {
      return;
    }
    const newRule = createDefaultWatchRule();
    const nextDraft = {
      rules: [...draft.rules, newRule],
    };
    setDraft(nextDraft);
    setExpandedRuleIds((current) => new Set(current).add(newRule.id));
    await persistDraft(nextDraft);
  }, [draft.rules, maxRules, persistDraft]);

  const pickWatchFolderForRule = useCallback(
    async (ruleId: string) => {
      setPickingWatchRuleId(ruleId);
      try {
        const path = await pickFolder();
        if (path) {
          const nextDraft = {
            ...draft,
            rules: draft.rules.map((rule) =>
              rule.id === ruleId ? { ...rule, watchPath: path } : rule
            ),
          };
          setDraft(nextDraft);
          await persistDraft(nextDraft);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : t('pickFolderFailed'), 'error');
      } finally {
        setPickingWatchRuleId(null);
      }
    },
    [draft, notify, persistDraft, pickFolder, t]
  );

  const handlePickWatchFolder = useCallback(
    async (ruleId: string) => {
      const ruleStatus = watcherStatus?.rules.find((rule) => rule.ruleId === ruleId);
      if (ruleStatus?.active) {
        setChangeFolderRuleId(ruleId);
        return;
      }
      await pickWatchFolderForRule(ruleId);
    },
    [pickWatchFolderForRule, watcherStatus?.rules]
  );

  const confirmChangeFolderWhileRunning = useCallback(async () => {
    const ruleId = changeFolderRuleId;
    if (!ruleId) {
      return;
    }
    setChangeFolderRuleId(null);
    setSaving(true);
    try {
      const nextDraft = {
        ...draft,
        rules: draft.rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: false } : rule)),
      };
      setDraft(nextDraft);
      const ok = await saveWatcherConfig(nextDraft);
      if (!ok) {
        notify(t('saveFailed'), 'error');
        return;
      }
      await pickWatchFolderForRule(ruleId);
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [changeFolderRuleId, draft, notify, pickWatchFolderForRule, saveWatcherConfig, t]);

  const handlePickMoveFolder = useCallback(
    async (ruleId: string) => {
      setPickingMoveRuleId(ruleId);
      try {
        const path = await pickMoveDestinationFolder();
        if (path) {
          await updateRule(ruleId, { customMovePath: path, postUploadAction: 'moveToCustom' });
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : t('pickFolderFailed'), 'error');
      } finally {
        setPickingMoveRuleId(null);
      }
    },
    [notify, pickMoveDestinationFolder, t, updateRule]
  );

  const handleEnabledChange = useCallback(
    async (ruleId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const enabling = event.target.checked;
      const rule = draft.rules.find((entry) => entry.id === ruleId);
      if (!rule) {
        return;
      }

      if (enabling) {
        if (!hasCredential) {
          notify(t('credentialRequired'), 'error');
          return;
        }
        if (!rule.watchPath) {
          notify(t('watchFolderRequired'), 'error');
          return;
        }
        if (rule.postUploadAction === 'moveToCustom' && !rule.customMovePath) {
          notify(t('customMovePathRequired'), 'error');
          return;
        }
      }

      const nextRule = { ...rule, enabled: enabling };

      if (enabling && nextRule.scanExistingOnEnable) {
        setScanConfirmRuleId(ruleId);
        return;
      }

      const nextDraft = {
        ...draft,
        rules: draft.rules.map((entry) => (entry.id === ruleId ? nextRule : entry)),
      };
      setDraft(nextDraft);
      await persistDraft(nextDraft);
    },
    [draft, hasCredential, notify, persistDraft, t]
  );

  const confirmEnableWithScan = useCallback(async () => {
    const ruleId = scanConfirmRuleId;
    if (!ruleId) {
      return;
    }
    setScanConfirmRuleId(null);
    const nextDraft = {
      ...draft,
      rules: draft.rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: true } : rule)),
    };
    setDraft(nextDraft);
    await persistDraft(nextDraft);
  }, [draft, persistDraft, scanConfirmRuleId]);

  const handleStart = useCallback(async () => {
    if (!hasCredential) {
      notify(t('credentialRequired'), 'error');
      return;
    }
    if (!draft.rules.some((rule) => rule.enabled && rule.watchPath)) {
      notify(t('watchFolderRequired'), 'error');
      return;
    }
    try {
      const scanExisting = draft.rules.some((rule) => rule.enabled && rule.scanExistingOnEnable);
      const ok = await startWatcher(scanExisting);
      notify(ok ? t('startSuccess') : t('startFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('startFailed'), 'error');
    }
  }, [draft.rules, hasCredential, notify, startWatcher, t]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      const ok = await stopWatcher();
      notify(ok ? t('stopSuccess') : t('stopFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('stopFailed'), 'error');
    } finally {
      setStopping(false);
    }
  }, [notify, stopWatcher, t]);

  const toggleRuleExpanded = useCallback((ruleId: string) => {
    setExpandedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  return {
    t,
    canUseWatcher,
    supportsMultiRule,
    canPickFolder,
    canUpload,
    maxRules,
    draft,
    watcherStatus,
    saving,
    stopping,
    pickingWatchRuleId,
    pickingMoveRuleId,
    scanConfirmRuleId,
    changeFolderRuleId,
    expandedRuleIds,
    isRunning: Boolean(watcherStatus?.running),
    canAddRule: draft.rules.length < maxRules,
    addRule,
    removeRule,
    updateRule,
    handlePickWatchFolder,
    handlePickMoveFolder,
    handleEnabledChange,
    handleStart,
    handleStop,
    toggleRuleExpanded,
    setScanConfirmRuleId,
    confirmEnableWithScan,
    setChangeFolderRuleId,
    confirmChangeFolderWhileRunning,
  };
}
