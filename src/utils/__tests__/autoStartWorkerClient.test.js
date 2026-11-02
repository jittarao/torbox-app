import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  checkAutoStartWorkerLiveness,
  configureAutoStartWorker,
  isAutoStartWorkerActive,
  resetAutoStartWorkerClientForTests,
  stopAutoStartWorker,
  subscribeAutoStartWorkerState,
} from '../autoStartWorkerClient';

const CONFIG = { enabled: true, apiKey: 'key', limit: 10, livenessIntervalMs: 30_000 };
const INTERVAL = CONFIG.livenessIntervalMs;

/** @type {Array<{ port: any, onerror: Function | null }>} */
let instances;
const originalSharedWorker = globalThis.SharedWorker;

class FakeSharedWorker {
  constructor() {
    const sent = [];
    this.onerror = null;
    this.port = {
      sent,
      closed: false,
      onmessage: null,
      start() {},
      close() {
        this.closed = true;
      },
      postMessage: (message) => sent.push(message),
      emit(data) {
        this.onmessage?.({ data });
      },
    };
    instances.push(this);
  }
}

const lastOfType = (port, type) => port.sent.filter((m) => m.type === type).at(-1);
const ack = (port) => port.emit({ type: 'autoStart:started' });
const pongLatest = (port, enabled = true) =>
  port.emit({ type: 'autoStart:pong', seq: lastOfType(port, 'autoStart:ping').seq, enabled });

describe('autoStartWorkerClient liveness', () => {
  beforeEach(() => {
    instances = [];
    globalThis.SharedWorker = FakeSharedWorker;
    resetAutoStartWorkerClientForTests();
  });

  afterEach(() => {
    resetAutoStartWorkerClientForTests();
    globalThis.SharedWorker = originalSharedWorker;
  });

  test('the page keeps ownership of auto-start until the worker acknowledges', () => {
    configureAutoStartWorker(CONFIG);
    expect(isAutoStartWorkerActive()).toBe(false);

    ack(instances[0].port);
    expect(isAutoStartWorkerActive()).toBe(true);
  });

  test('a silently dead worker hands back to the page and is replaced', () => {
    configureAutoStartWorker(CONFIG);
    const dead = instances[0].port;
    ack(dead);

    checkAutoStartWorkerLiveness(INTERVAL);
    expect(isAutoStartWorkerActive()).toBe(true);

    checkAutoStartWorkerLiveness(INTERVAL * 2);
    expect(isAutoStartWorkerActive()).toBe(true);

    checkAutoStartWorkerLiveness(INTERVAL * 3);
    expect(isAutoStartWorkerActive()).toBe(false);
    expect(dead.closed).toBe(true);
    expect(instances).toHaveLength(2);

    const replacement = instances[1].port;
    expect(lastOfType(replacement, 'autoStart:configure').apiKey).toBe('key');

    ack(replacement);
    expect(isAutoStartWorkerActive()).toBe(true);
  });

  test('a responsive worker is never replaced', () => {
    configureAutoStartWorker(CONFIG);
    const { port } = instances[0];
    ack(port);

    for (let i = 1; i <= 10; i += 1) {
      checkAutoStartWorkerLiveness(INTERVAL * i);
      pongLatest(port);
    }

    expect(instances).toHaveLength(1);
    expect(isAutoStartWorkerActive()).toBe(true);
  });

  test('checks closer together than the grace window do not count as misses', () => {
    configureAutoStartWorker(CONFIG);
    ack(instances[0].port);

    checkAutoStartWorkerLiveness(INTERVAL);
    for (let i = 1; i <= 10; i += 1) {
      checkAutoStartWorkerLiveness(INTERVAL + i);
    }

    expect(instances).toHaveLength(1);
    expect(isAutoStartWorkerActive()).toBe(true);
  });

  test('re-enrolls when a live worker reports it lost this window', () => {
    configureAutoStartWorker(CONFIG);
    const { port } = instances[0];
    ack(port);
    const configuresBefore = port.sent.filter((m) => m.type === 'autoStart:configure').length;

    checkAutoStartWorkerLiveness(INTERVAL);
    pongLatest(port, false);

    expect(port.sent.filter((m) => m.type === 'autoStart:configure').length).toBe(
      configuresBefore + 1
    );
    expect(isAutoStartWorkerActive()).toBe(false);
  });

  test('a replaced worker is detached so late messages cannot reclaim ownership', () => {
    configureAutoStartWorker(CONFIG);
    const dead = instances[0].port;
    ack(dead);

    checkAutoStartWorkerLiveness(INTERVAL);
    checkAutoStartWorkerLiveness(INTERVAL * 2);
    checkAutoStartWorkerLiveness(INTERVAL * 3);

    ack(dead);
    expect(dead.onmessage).toBeNull();
    expect(isAutoStartWorkerActive()).toBe(false);
  });

  test('a worker script load error hands back to the page, then retries', () => {
    configureAutoStartWorker(CONFIG);
    ack(instances[0].port);

    instances[0].onerror();
    expect(isAutoStartWorkerActive()).toBe(false);

    checkAutoStartWorkerLiveness(INTERVAL);
    expect(instances).toHaveLength(2);
    ack(instances[1].port);
    expect(isAutoStartWorkerActive()).toBe(true);
  });

  test('stopping ends liveness checks and tells the worker', () => {
    configureAutoStartWorker(CONFIG);
    const { port } = instances[0];
    ack(port);

    stopAutoStartWorker();
    const pingsAfterStop = port.sent.filter((m) => m.type === 'autoStart:ping').length;
    checkAutoStartWorkerLiveness(INTERVAL * 5);

    expect(lastOfType(port, 'autoStart:stop')).toBeTruthy();
    expect(port.sent.filter((m) => m.type === 'autoStart:ping').length).toBe(pingsAfterStop);
    expect(isAutoStartWorkerActive()).toBe(false);
    expect(instances).toHaveLength(1);
  });

  test('notifies state listeners when ownership changes', () => {
    let notified = 0;
    subscribeAutoStartWorkerState(() => {
      notified += 1;
    });
    configureAutoStartWorker(CONFIG);
    const before = notified;
    ack(instances[0].port);
    expect(notified).toBeGreaterThan(before);
  });

  test('without SharedWorker the page keeps ownership', () => {
    globalThis.SharedWorker = undefined;
    expect(configureAutoStartWorker(CONFIG)).toBe(false);
    expect(isAutoStartWorkerActive()).toBe(false);
  });
});
