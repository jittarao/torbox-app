import { describe, expect, test, mock, afterEach, beforeEach } from 'bun:test';
import { hasFeature } from '@/desktop/capabilities';

describe('hasFeature', () => {
  test('returns true when feature exists', () => {
    expect(
      hasFeature(
        {
          protocolVersion: 1,
          features: { secureCredentials: { version: 1, canStoreApiKey: true } },
        },
        'secureCredentials'
      )
    ).toBe(true);
  });

  test('returns false when capabilities are null', () => {
    expect(hasFeature(null, 'secureCredentials')).toBe(false);
  });
});

describe('desktopBridge browser fallback', () => {
  afterEach(() => {
    mock.restore();
    delete globalThis.window;
  });

  beforeEach(() => {
    globalThis.window = {};
  });

  test('isAvailable returns false outside Tauri', async () => {
    const { isAvailable, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(isAvailable()).resolves.toBe(false);
  });

  test('hello returns null outside Tauri', async () => {
    const { hello } = await import('@/desktop/desktopBridge');
    await expect(hello()).resolves.toBeNull();
  });

  test('getCredentialStatus returns null outside Tauri', async () => {
    const { getCredentialStatus, resetAvailabilityCache } = await import('@/desktop/desktopBridge');
    resetAvailabilityCache();
    await expect(getCredentialStatus()).resolves.toBeNull();
  });
});
