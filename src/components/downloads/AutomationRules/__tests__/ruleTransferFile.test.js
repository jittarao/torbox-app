import { describe, expect, test } from 'bun:test';
import {
  IMPORT_FILE_ERRORS,
  MAX_IMPORT_FILE_BYTES,
  RULES_EXPORT_FORMAT,
  RuleImportFileError,
  buildRulesExportFilename,
  readRulesImportFile,
} from '../ruleTransferFile';

function jsonFile(value, name = 'rules.json') {
  return new File([typeof value === 'string' ? value : JSON.stringify(value)], name, {
    type: 'application/json',
  });
}

async function expectFileError(file, code) {
  try {
    await readRulesImportFile(file);
    throw new Error('expected readRulesImportFile to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(RuleImportFileError);
    expect(error.code).toBe(code);
  }
}

describe('buildRulesExportFilename', () => {
  test('uses the UTC date', () => {
    expect(buildRulesExportFilename(new Date('2026-11-08T23:30:00.000Z'))).toBe(
      'torbox-automation-rules-2026-11-08.json'
    );
  });
});

describe('readRulesImportFile', () => {
  test('returns the parsed payload for a rules export', async () => {
    const payload = { format: RULES_EXPORT_FORMAT, version: 1, rules: [], tags: [] };
    expect(await readRulesImportFile(jsonFile(payload))).toEqual(payload);
  });

  test('rejects files over the size limit', async () => {
    await expectFileError(
      jsonFile('x'.repeat(MAX_IMPORT_FILE_BYTES + 1)),
      IMPORT_FILE_ERRORS.TOO_LARGE
    );
  });

  test('rejects invalid JSON', async () => {
    await expectFileError(jsonFile('{not json'), IMPORT_FILE_ERRORS.NOT_JSON);
  });

  test('rejects JSON that is not a rules export', async () => {
    await expectFileError(jsonFile({ hello: 'world' }), IMPORT_FILE_ERRORS.WRONG_FORMAT);
    await expectFileError(jsonFile([1, 2]), IMPORT_FILE_ERRORS.WRONG_FORMAT);
  });
});
