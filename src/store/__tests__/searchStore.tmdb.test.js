import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { useSessionStore } from '@/store/sessionStore';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';
import { useTmdbCredentialsStore } from '@/store/tmdbCredentialsStore';
import { apiKeyStorageScope } from '@/store/downloadsSelectionStore';
import { useSearchStore, searchHistoryStorageKey, typesNeedRescope } from '../searchStore.js';

const KEY_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const KEY_B = 'bbbbbbbb-bbbb-cccc-dddd-ffffffffffff';

function mockLocalStorage() {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
  return storage;
}

function resetStores() {
  useSearchStore.setState({
    query: '',
    results: [],
    loading: false,
    error: null,
    validationError: null,
    hasSearchCompleted: false,
    activeRequestId: 0,
    abortController: null,
    addonStatuses: [],
    searchHistory: [],
    filterResetNonce: 0,
    pendingSearchQuery: null,
    pendingSearchOptions: null,
    pendingEpisodePick: null,
  });
  useTmdbCredentialsStore.setState({
    configured: false,
    loading: false,
    hasLoaded: true,
    mutating: false,
    error: null,
  });
  useStremioAddonsStore.setState({
    addons: [
      {
        id: 1,
        addon_id: 'com.test.streams',
        name: 'Test',
        enabled: true,
        types: ['movie', 'series'],
        id_prefixes: ['tt'],
        sort_order: 0,
      },
    ],
    loading: false,
    error: null,
  });
}

describe('typesNeedRescope', () => {
  test('true when scoped is a proper subset', () => {
    expect(typesNeedRescope(['movie', 'series'], ['movie'])).toBe(true);
    expect(typesNeedRescope(['movie'], ['movie'])).toBe(false);
    expect(typesNeedRescope(['movie'], ['series'])).toBe(false);
  });
});

describe('searchStore history scoping', () => {
  beforeEach(() => {
    mockLocalStorage();
    resetStores();
    useSessionStore.setState({ apiKey: KEY_A, hydrated: true });
  });

  test('persists history under per-api-key scoped key', () => {
    useTmdbCredentialsStore.setState({ configured: false, hasLoaded: true });
    useSearchStore.getState().addToHistory({ kind: 'media_id', streamId: 'tt0111161' });

    const key = searchHistoryStorageKey(KEY_A);
    expect(key).toBe(`stremioSearchHistory:v2:${apiKeyStorageScope(KEY_A)}`);
    const raw = JSON.parse(localStorage.getItem(key));
    expect(raw[0]).toMatchObject({ kind: 'media_id', streamId: 'tt0111161' });
    expect(localStorage.getItem('stremioSearchHistory:v2')).toBe(null);
  });

  test('resetForSession loads the new user history, not the previous user', () => {
    useSearchStore.getState().addToHistory({ kind: 'media_id', streamId: 'tt0111161' });
    expect(useSearchStore.getState().searchHistory).toHaveLength(1);

    useSessionStore.setState({ apiKey: KEY_B });
    useSearchStore.getState().resetForSession();
    expect(useSearchStore.getState().searchHistory).toEqual([]);

    useSearchStore.getState().addToHistory({ kind: 'media_id', streamId: 'tt0499549' });
    expect(useSearchStore.getState().searchHistory[0].streamId).toBe('tt0499549');

    useSessionStore.setState({ apiKey: KEY_A });
    useSearchStore.getState().resetForSession();
    expect(useSearchStore.getState().searchHistory[0].streamId).toBe('tt0111161');
  });

  test('migrates unscoped v2 into current user bucket once', () => {
    localStorage.setItem(
      'stremioSearchHistory:v2',
      JSON.stringify([{ kind: 'media_id', streamId: 'tt0111161' }])
    );
    useSearchStore.getState().loadHistory();

    const scoped = searchHistoryStorageKey(KEY_A);
    expect(JSON.parse(localStorage.getItem(scoped))[0].streamId).toBe('tt0111161');
    expect(localStorage.getItem('stremioSearchHistory:v2')).toBe(null);

    useSessionStore.setState({ apiKey: KEY_B });
    useSearchStore.getState().resetForSession();
    expect(useSearchStore.getState().searchHistory).toEqual([]);
  });

  test('clearHistory removes scoped and legacy keys', () => {
    useSearchStore.getState().addToHistory({ kind: 'media_id', streamId: 'tt1' });
    localStorage.setItem('stremioSearchHistory:v1', JSON.stringify(['tt2']));
    localStorage.setItem('torboxSearchHistory:v1', JSON.stringify(['tt3']));
    useSearchStore.getState().clearHistory();
    expect(localStorage.getItem(searchHistoryStorageKey(KEY_A))).toBe(null);
    expect(localStorage.getItem('stremioSearchHistory:v1')).toBe(null);
    expect(localStorage.getItem('torboxSearchHistory:v1')).toBe(null);
  });
});

describe('searchStore enrichAndMaybeRescope', () => {
  let originalFetch;

  beforeEach(() => {
    mockLocalStorage();
    resetStores();
    useSessionStore.setState({ apiKey: KEY_A, hydrated: true });
    useTmdbCredentialsStore.setState({ configured: true, hasLoaded: true });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('movie find rescopes to movie-only when dual-type was in flight', async () => {
    const fetchResultsCalls = [];
    const originalFetchResults = useSearchStore.getState().fetchResults;
    useSearchStore.setState({
      activeRequestId: 7,
      fetchResults: async (mediaId, options) => {
        fetchResultsCalls.push({ mediaId, options });
      },
    });

    globalThis.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          tmdbId: 19995,
          mediaType: 'movie',
          title: 'Avatar',
          year: '2009',
          posterPath: '/a.jpg',
          imdbId: 'tt0499549',
          streamId: 'tt0499549',
        },
      }),
    }));

    await useSearchStore.getState().enrichAndMaybeRescope('tt0499549', 7, ['movie', 'series']);

    expect(fetchResultsCalls).toHaveLength(1);
    expect(fetchResultsCalls[0]).toMatchObject({
      mediaId: 'tt0499549',
      options: { types: ['movie'], skipEnrich: true },
    });
    expect(useSearchStore.getState().pendingEpisodePick).toBe(null);
    expect(useSearchStore.getState().searchHistory[0]).toMatchObject({
      kind: 'tmdb',
      title: 'Avatar',
      mediaType: 'movie',
    });

    useSearchStore.setState({ fetchResults: originalFetchResults });
  });

  test('tv find upserts history and opens episode picker without rescope', async () => {
    const fetchResultsCalls = [];
    useSearchStore.setState({
      activeRequestId: 3,
      fetchResults: async (mediaId, options) => {
        fetchResultsCalls.push({ mediaId, options });
      },
    });

    globalThis.fetch = mock(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          tmdbId: 1399,
          mediaType: 'tv',
          title: 'Game of Thrones',
          year: '2011',
          posterPath: null,
          imdbId: 'tt0944947',
          streamId: 'tt0944947',
        },
      }),
    }));

    await useSearchStore.getState().enrichAndMaybeRescope('tt0944947', 3, ['movie', 'series']);

    expect(fetchResultsCalls).toHaveLength(0);
    expect(useSearchStore.getState().pendingEpisodePick).toMatchObject({
      kind: 'tmdb',
      mediaType: 'tv',
      title: 'Game of Thrones',
      streamId: 'tt0944947',
    });
    expect(useSearchStore.getState().searchHistory[0].mediaType).toBe('tv');
  });

  test('skips enrich for bare tmdb ids', async () => {
    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    useSearchStore.setState({ activeRequestId: 1 });
    await useSearchStore.getState().enrichAndMaybeRescope('tmdb:19995', 1, ['movie', 'series']);
    expect(fetchCalled).toBe(false);
  });
});
