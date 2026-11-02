import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { resetAutoStartWorkerClientForTests } from '@/utils/autoStartWorkerClient';
import { useAutoStartWorker } from '../useAutoStartWorker';

const originalSharedWorker = globalThis.SharedWorker;
const originalLocalStorage = globalThis.localStorage;
/** @type {Array<{ type: string }>} */
let sent;

class FakeSharedWorker {
  constructor() {
    this.port = { start() {}, close() {}, postMessage: (message) => sent.push(message) };
  }
}

const setOptions = (options) =>
  localStorage.setItem('torrent-upload-options', JSON.stringify(options));

describe('useAutoStartWorker', () => {
  beforeEach(() => {
    sent = [];
    globalThis.localStorage = window.localStorage;
    globalThis.SharedWorker = FakeSharedWorker;
    resetAutoStartWorkerClientForTests();
  });

  afterEach(() => {
    resetAutoStartWorkerClientForTests();
    globalThis.SharedWorker = originalSharedWorker;
    localStorage.removeItem('torrent-upload-options');
    globalThis.localStorage = originalLocalStorage;
  });

  test('runs from the API key and setting alone, with the configured limit', () => {
    setOptions({ autoStart: true, autoStartLimit: 10 });
    renderHook(() => useAutoStartWorker({ apiKey: 'key' }));

    const configure = sent.find((m) => m.type === 'autoStart:configure');
    expect(configure.apiKey).toBe('key');
    expect(configure.limit).toBe(10);
  });

  test('stays off when the setting is disabled', () => {
    setOptions({ autoStart: false, autoStartLimit: 10 });
    renderHook(() => useAutoStartWorker({ apiKey: 'key' }));

    expect(sent.some((m) => m.type === 'autoStart:configure')).toBe(false);
  });

  test('stops the worker when the shell unmounts', () => {
    setOptions({ autoStart: true, autoStartLimit: 10 });
    const { unmount } = renderHook(() => useAutoStartWorker({ apiKey: 'key' }));
    unmount();

    expect(sent.at(-1).type).toBe('autoStart:stop');
  });
});
