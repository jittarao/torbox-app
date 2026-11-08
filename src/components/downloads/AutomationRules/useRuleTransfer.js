'use client';

import { useCallback, useRef, useState } from 'react';
import { useAutomationRulesStore } from '@/store/automationRulesStore';
import { useTagsStore } from '@/store/tagsStore';
import {
  RuleImportFileError,
  buildRulesExportFilename,
  downloadJsonFile,
  readRulesImportFile,
} from './ruleTransferFile';

/**
 * Export/import automation rules as a JSON file (backend mode only).
 * @param {{ apiKey: string, t: (key: string, values?: object) => string }} options
 */
export function useRuleTransfer({ apiKey, t }) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const clearToast = useCallback(() => setToast(null), []);

  const handleExport = async () => {
    setBusy('export');
    try {
      const payload = await useAutomationRulesStore.getState().exportRules(apiKey);
      downloadJsonFile(payload, buildRulesExportFilename());
      setToast({
        type: 'success',
        message: t('transfer.exportSuccess', { count: payload.rules.length }),
      });
    } catch (error) {
      setToast({ type: 'error', message: t('transfer.exportFailed', { error: error.message }) });
    } finally {
      setBusy(null);
    }
  };

  const openImportPicker = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires onChange
    event.target.value = '';
    if (!file) return;

    setBusy('import');
    try {
      const payload = await readRulesImportFile(file);
      const { importedCount, skipped, createdTagCount } = await useAutomationRulesStore
        .getState()
        .importRules(apiKey, payload);
      if (createdTagCount > 0) {
        await useTagsStore.getState().loadTags(apiKey, { force: true });
      }
      if (skipped.length > 0) {
        console.warn('Skipped automation rules during import:', skipped);
      }

      if (importedCount === 0) {
        setToast({
          type: 'error',
          message: t('transfer.importNothing', { skipped: skipped.length }),
        });
      } else if (skipped.length > 0) {
        setToast({
          type: 'success',
          message: t('transfer.importPartial', {
            imported: importedCount,
            skipped: skipped.length,
          }),
        });
      } else {
        setToast({
          type: 'success',
          message: t('transfer.importSuccess', { imported: importedCount }),
        });
      }
    } catch (error) {
      const message =
        error instanceof RuleImportFileError
          ? t(`transfer.fileErrors.${error.code}`)
          : t('transfer.importFailed', { error: error.message });
      setToast({ type: 'error', message });
    } finally {
      setBusy(null);
    }
  };

  return {
    busy,
    toast,
    clearToast,
    fileInputRef,
    handleExport,
    openImportPicker,
    handleImportFile,
  };
}
