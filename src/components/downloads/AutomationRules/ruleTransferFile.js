/** Keep in sync with backend/src/automation/helpers/ruleTransfer.js */
export const RULES_EXPORT_FORMAT = 'torbox-manager.automation-rules';
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

/** Values are i18n keys under AutomationRules.transfer.fileErrors */
export const IMPORT_FILE_ERRORS = {
  TOO_LARGE: 'tooLarge',
  NOT_JSON: 'notJson',
  WRONG_FORMAT: 'wrongFormat',
};

export class RuleImportFileError extends Error {
  constructor(code) {
    super(code);
    this.name = 'RuleImportFileError';
    this.code = code;
  }
}

export function buildRulesExportFilename(date = new Date()) {
  return `torbox-automation-rules-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Read and pre-check an uploaded export file. Per-rule validation happens on the backend.
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function readRulesImportFile(file) {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new RuleImportFileError(IMPORT_FILE_ERRORS.TOO_LARGE);
  }
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new RuleImportFileError(IMPORT_FILE_ERRORS.NOT_JSON);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    payload.format !== RULES_EXPORT_FORMAT
  ) {
    throw new RuleImportFileError(IMPORT_FILE_ERRORS.WRONG_FORMAT);
  }
  return payload;
}

export function downloadJsonFile(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
