import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { useSessionStore } from '@/store/sessionStore';
import { useStremioAddonsStore } from '@/store/stremioAddonsStore';

const VALID_KEY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function resetAddonsStore() {
  useStremioAddonsStore.getState().resetForSession();
}

describe('stremioAddonsStore.fetchAddons', () => {
  let originalFetch;

  beforeEach(() => {
    resetAddonsStore();
    useSessionStore.setState({ apiKey: VALID_KEY, hydrated: true });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetAddonsStore();
  });

  test('concurrent fetchAddons calls share one network request', async () => {
    let resolveFetch;
    let fetchCount = 0;

    globalThis.fetch = async () => {
      fetchCount += 1;
      return new Promise((resolve) => {
        resolveFetch = () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, addons: [{ id: 1, name: 'Test' }] }),
          });
      });
    };

    const p1 = useStremioAddonsStore.getState().fetchAddons();
    const p2 = useStremioAddonsStore.getState().fetchAddons();

    expect(fetchCount).toBe(1);

    resolveFetch();
    await Promise.all([p1, p2]);

    expect(fetchCount).toBe(1);
    expect(useStremioAddonsStore.getState().addons).toEqual([{ id: 1, name: 'Test' }]);
    expect(useStremioAddonsStore.getState().loading).toBe(false);
  });

  test('skips a second fetch after a successful load', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, addons: [] }),
      };
    };

    await useStremioAddonsStore.getState().fetchAddons();
    await useStremioAddonsStore.getState().fetchAddons();

    expect(fetchCount).toBe(1);
    expect(useStremioAddonsStore.getState().hasLoaded).toBe(true);
  });

  test('force: true refetches after a successful load', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          addons: [{ id: fetchCount, name: `Addon ${fetchCount}` }],
        }),
      };
    };

    await useStremioAddonsStore.getState().fetchAddons();
    await useStremioAddonsStore.getState().fetchAddons({ force: true });

    expect(fetchCount).toBe(2);
    expect(useStremioAddonsStore.getState().addons[0].id).toBe(2);
  });
});
