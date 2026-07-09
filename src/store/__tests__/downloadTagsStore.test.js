import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { applyOptimisticTagMappings, useDownloadTagsStore } from '@/store/downloadTagsStore';
import {
  resetBackendModeCacheForTests,
  setBackendAvailableForTests,
} from '@/utils/backendModeCache';

function resetStore() {
  useDownloadTagsStore.setState({
    tagMappings: {},
    loading: false,
    error: null,
    hasLoaded: false,
    currentApiKey: null,
    activeRequestId: 0,
  });
}

describe('applyOptimisticTagMappings', () => {
  const allTags = [
    { id: 1, name: 'Movies' },
    { id: 2, name: 'TV' },
  ];

  test('add merges tags for download ids', () => {
    const next = applyOptimisticTagMappings({}, ['42'], [1], 'add', allTags);
    expect(next['42']).toEqual([{ id: 1, name: 'Movies' }]);
  });

  test('add appends without duplicating existing tags', () => {
    const next = applyOptimisticTagMappings(
      { 42: [{ id: 1, name: 'Movies' }] },
      ['42'],
      [1, 2],
      'add',
      allTags
    );
    expect(next['42']).toEqual([
      { id: 1, name: 'Movies' },
      { id: 2, name: 'TV' },
    ]);
  });

  test('remove drops tags and clears empty download keys', () => {
    const next = applyOptimisticTagMappings(
      { 42: [{ id: 1, name: 'Movies' }] },
      ['42'],
      [1],
      'remove',
      allTags
    );
    expect(next['42']).toBeUndefined();
  });

  test('remove keeps remaining tags on a download', () => {
    const next = applyOptimisticTagMappings(
      {
        42: [
          { id: 1, name: 'Movies' },
          { id: 2, name: 'TV' },
        ],
      },
      ['42'],
      [1],
      'remove',
      allTags
    );
    expect(next['42']).toEqual([{ id: 2, name: 'TV' }]);
  });
});

describe('useDownloadTagsStore loading state', () => {
  let originalFetch;
  let originalLocation;

  beforeEach(() => {
    resetBackendModeCacheForTests();
    setBackendAvailableForTests(true);
    resetStore();
    originalFetch = globalThis.fetch;
    originalLocation = globalThis.window?.location;
    globalThis.fetch = undefined;
    if (globalThis.window) {
      globalThis.window.location = { origin: 'http://localhost', href: 'http://localhost/' };
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (globalThis.window && originalLocation) {
      globalThis.window.location = originalLocation;
    }
    resetBackendModeCacheForTests();
  });

  test('API key change resets loading to false', () => {
    useDownloadTagsStore.setState({ loading: true, currentApiKey: 'key-a' });
    useDownloadTagsStore.getState().setApiKey('key-b');
    expect(useDownloadTagsStore.getState().loading).toBe(false);
    expect(useDownloadTagsStore.getState().currentApiKey).toBe('key-b');
  });

  test('stale request resets loading when API key changes before fetch resolves', async () => {
    let resolveFetch;
    globalThis.fetch = mock(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const fetchPromise = useDownloadTagsStore.getState().fetchDownloadTags('key-a');
    expect(useDownloadTagsStore.getState().loading).toBe(true);

    useDownloadTagsStore.getState().setApiKey('key-b');

    resolveFetch({ ok: true, json: async () => ({ success: true, mappings: {} }) });
    await fetchPromise;

    expect(useDownloadTagsStore.getState().loading).toBe(false);
  });
});
