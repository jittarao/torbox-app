import { afterEach, describe, expect, test } from 'bun:test';
import { EXTERNAL_APP_NOT_INSTALLED, launchExternalUrl } from '@/utils/launchExternalUrl';

describe('launchExternalUrl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('resolves when window blurs before timeout', async () => {
    const promise = launchExternalUrl('infuse://play?url=test', { timeoutMs: 500 });

    window.dispatchEvent(new Event('blur'));

    await expect(promise).resolves.toBeUndefined();
  });

  test('resolves when document becomes hidden before timeout', async () => {
    const promise = launchExternalUrl('iina://weblink?url=test', { timeoutMs: 500 });

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });

    await expect(promise).resolves.toBeUndefined();
  });

  test('rejects when no handoff is detected within timeout', async () => {
    const promise = launchExternalUrl('infuse://play?url=test', { timeoutMs: 50 });

    await expect(promise).rejects.toMatchObject({
      message: EXTERNAL_APP_NOT_INSTALLED,
      code: EXTERNAL_APP_NOT_INSTALLED,
    });
  });

  test('clicks a transient anchor with the target URL', () => {
    const clicked = [];
    const originalCreateElement = document.createElement.bind(document);

    document.createElement = (tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = () => clicked.push(element.href);
      }
      return element;
    };

    launchExternalUrl('stremio://search?search=test', { timeoutMs: 10_000 });
    window.dispatchEvent(new Event('blur'));

    expect(clicked).toEqual(['stremio://search?search=test']);

    document.createElement = originalCreateElement;
  });
});
