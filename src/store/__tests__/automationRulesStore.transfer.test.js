import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useAutomationRulesStore } from '@/store/automationRulesStore';

const realFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('automationRulesStore export/import', () => {
  beforeEach(() => {
    useAutomationRulesStore.setState({
      rules: [{ id: 1, name: 'Existing' }],
      loading: false,
      error: null,
      currentApiKey: 'key-a',
      activeRequestId: 0,
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('exportRules returns the export payload', async () => {
    const payload = { format: 'torbox-manager.automation-rules', version: 1, rules: [], tags: [] };
    globalThis.fetch = async (url, init) => {
      expect(url).toBe('/api/automation/rules/export');
      expect(init.headers['x-api-key']).toBe('key-a');
      return jsonResponse({ success: true, data: payload });
    };
    expect(await useAutomationRulesStore.getState().exportRules('key-a')).toEqual(payload);
  });

  test('importRules prepends imported rules and returns a summary', async () => {
    globalThis.fetch = async (url, init) => {
      expect(url).toBe('/api/automation/rules/import');
      expect(JSON.parse(init.body)).toEqual({ data: { format: 'x' } });
      return jsonResponse({
        success: true,
        importedRules: [{ id: 2, name: 'Imported' }],
        skipped: [{ index: 1, name: 'Existing', reason: 'duplicate' }],
        createdTagCount: 1,
      });
    };

    const summary = await useAutomationRulesStore.getState().importRules('key-a', { format: 'x' });

    expect(summary).toEqual({
      importedCount: 1,
      skipped: [{ index: 1, name: 'Existing', reason: 'duplicate' }],
      createdTagCount: 1,
    });
    expect(useAutomationRulesStore.getState().rules.map((r) => r.name)).toEqual([
      'Imported',
      'Existing',
    ]);
  });

  test('importRules does not touch rules when the api key changed mid-request', async () => {
    globalThis.fetch = async () => {
      useAutomationRulesStore.getState().setApiKey('key-b');
      return jsonResponse({ success: true, importedRules: [{ id: 9 }], skipped: [] });
    };
    await useAutomationRulesStore.getState().importRules('key-a', {});
    expect(useAutomationRulesStore.getState().rules).toEqual([]);
  });

  test('importRules throws the backend error message', async () => {
    globalThis.fetch = async () =>
      jsonResponse({ success: false, error: 'Unsupported export version: 9' }, 400);
    await expect(useAutomationRulesStore.getState().importRules('key-a', {})).rejects.toThrow(
      'Unsupported export version: 9'
    );
  });
});
