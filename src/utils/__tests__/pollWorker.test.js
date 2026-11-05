import { beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

const PUBLIC_DIR = join(import.meta.dir, '../../../public');
const WORKER_SOURCE = readFileSync(join(PUBLIC_DIR, 'poll-worker.js'), 'utf8');
const LOGIC_SOURCE = readFileSync(join(PUBLIC_DIR, 'auto-start-logic.js'), 'utf8');

const CONFIG = {
  type: 'autoStart:configure',
  enabled: true,
  apiKey: 'key',
  origin: 'https://tbm.test',
  limit: 2,
  queuedIntervalMs: 60_000,
  watchIntervalMs: 120_000,
  betweenStartsMs: 0,
  processedTtlMs: 90_000,
  requestTimeoutMs: 30_000,
};

async function flushMicrotasks() {
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
  }
}

/** Runs the real worker script against a virtual clock and a scripted fetch. */
function loadWorker(fetchImpl) {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();

  const self = {};
  const context = vm.createContext({
    self,
    globalThis: self,
    console,
    Map,
    Set,
    Promise,
    AbortController,
    JSON,
    Math,
    Number,
    String,
    Array,
    Date: { now: () => now },
    fetch: (...args) => fetchImpl(...args),
    setTimeout: (fn, ms = 0) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    importScripts: () => vm.runInContext(LOGIC_SOURCE, context),
  });
  vm.runInContext(WORKER_SOURCE, context);

  const advance = async (ms) => {
    const end = now + ms;
    await flushMicrotasks();
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = Math.max(now, due[1].at);
      due[1].fn();
      await flushMicrotasks();
    }
    now = end;
  };

  const connect = () => {
    const listeners = new Map();
    const received = [];
    const port = {
      received,
      start() {},
      postMessage: (message) => received.push(message),
      addEventListener: (name, fn) => listeners.set(name, fn),
      send: (message) => port.onmessage({ data: message }),
      fireClose: () => listeners.get('close')?.(),
    };
    self.onconnect({ ports: [port] });
    return port;
  };

  return { advance, connect };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** Scripted TorBox: `list` is mutable state; every call is recorded. */
function createApi(list) {
  const api = {
    list,
    listCalls: 0,
    started: [],
    listHandler: null,
    fetch: async (url, init = {}) => {
      if (String(url).endsWith('/api/torrents')) {
        api.listCalls += 1;
        if (api.listHandler) return api.listHandler(init);
        return jsonResponse({ success: true, data: api.list });
      }
      const { queued_id: queuedId } = JSON.parse(init.body);
      api.started.push(queuedId);
      api.list = api.list.map((item) =>
        item.id === queuedId ? { id: queuedId, active: true } : item
      );
      return jsonResponse({ success: true });
    },
  };
  return api;
}

const queued = (id) => ({ id, status: 'queued' });
const active = (id) => ({ id, active: true });

describe('poll-worker auto-start loop', () => {
  /** @type {ReturnType<typeof createApi>} */
  let api;
  /** @type {ReturnType<typeof loadWorker>} */
  let worker;

  beforeEach(() => {
    api = createApi([]);
    worker = loadWorker(api.fetch);
  });

  test('starts queued torrents only up to the active limit', async () => {
    api.list = [active(1), queued(10), queued(11), queued(12)];
    worker.connect().send(CONFIG);
    await worker.advance(0);

    expect(api.started).toEqual([10]);

    await worker.advance(60_000);
    expect(api.started).toEqual([10]);

    api.list = api.list.filter((item) => item.id !== 1);
    await worker.advance(60_000);
    expect(api.started).toEqual([10, 11]);
  });

  test('retries on the queued interval after a failed list fetch', async () => {
    api.list = [queued(10)];
    api.listHandler = () => jsonResponse({ success: false }, 503);
    worker.connect().send(CONFIG);
    await worker.advance(0);
    expect(api.listCalls).toBe(1);

    api.listHandler = null;
    await worker.advance(CONFIG.queuedIntervalMs);

    expect(api.listCalls).toBe(2);
    expect(api.started).toEqual([10]);
  });

  test('treats an unsuccessful list body as a failure, not an empty queue', async () => {
    api.list = [queued(10)];
    api.listHandler = () => jsonResponse({ success: false });
    worker.connect().send(CONFIG);
    await worker.advance(0);

    api.listHandler = null;
    await worker.advance(CONFIG.queuedIntervalMs);

    expect(api.started).toEqual([10]);
  });

  test('keeps the last known counts in the result after a failed fetch', async () => {
    api.list = [active(1), queued(10), queued(11)];
    const port = worker.connect();
    port.send({ ...CONFIG, limit: 1 });
    await worker.advance(0);

    api.listHandler = () => jsonResponse({}, 500);
    await worker.advance(CONFIG.queuedIntervalMs);

    const results = port.received.filter((m) => m.type === 'autoStart:result');
    expect(results.at(-1).activeCount).toBe(1);
    expect(results.at(-1).queuedCount).toBe(2);
  });

  test('a hung list fetch times out and the loop keeps running', async () => {
    api.list = [queued(10)];
    let signal = null;
    api.listHandler = (init) => {
      signal = init.signal;
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    };
    worker.connect().send(CONFIG);
    await worker.advance(0);
    expect(signal).toBeTruthy();

    api.listHandler = null;
    await worker.advance(CONFIG.requestTimeoutMs + CONFIG.queuedIntervalMs);

    expect(signal.aborted).toBe(true);
    expect(api.started).toEqual([10]);
  });

  test('a failed start does not block later queued ids or retries', async () => {
    api.list = [queued(10), queued(11)];
    const realFetch = api.fetch;
    let failed = false;
    const failing = loadWorker(async (url, init) => {
      if (!failed && String(url).endsWith('/controlqueued')) {
        failed = true;
        throw new Error('network blip');
      }
      return realFetch(url, init);
    });

    failing.connect().send(CONFIG);
    await failing.advance(0);
    expect(api.started).toEqual([11]);

    // The failed id is marked so it is skipped while the TTL is active.
    await failing.advance(CONFIG.queuedIntervalMs);
    expect(api.started).toEqual([11]);

    await failing.advance(CONFIG.queuedIntervalMs);
    expect(api.started).toEqual([11, 10]);
  });

  test('polls within the watch interval when the queue was empty', async () => {
    worker.connect().send(CONFIG);
    await worker.advance(0);

    api.list = [queued(10)];
    await worker.advance(CONFIG.watchIntervalMs);

    expect(api.started).toEqual([10]);
  });

  test('one window stopping does not stop another window that still needs it', async () => {
    const minimizedWindow = worker.connect();
    const otherWindow = worker.connect();
    minimizedWindow.send(CONFIG);
    otherWindow.send(CONFIG);
    await worker.advance(0);

    otherWindow.send({ type: 'autoStart:stop' });

    api.list = [queued(10)];
    await worker.advance(CONFIG.watchIntervalMs);
    expect(api.started).toEqual([10]);
  });

  test('a closed window hands the loop to the remaining window', async () => {
    const minimizedWindow = worker.connect();
    const closedWindow = worker.connect();
    minimizedWindow.send(CONFIG);
    closedWindow.send({ ...CONFIG, limit: 1 });
    await worker.advance(0);

    closedWindow.fireClose();
    await worker.advance(0);

    api.list = [active(1), queued(10)];
    await worker.advance(CONFIG.watchIntervalMs);
    expect(api.started).toEqual([10]);
  });

  test('the loop stops once the last window has stopped', async () => {
    const port = worker.connect();
    port.send(CONFIG);
    await worker.advance(0);
    const callsBeforeStop = api.listCalls;

    port.send({ type: 'autoStart:stop' });
    await worker.advance(CONFIG.watchIntervalMs * 3);

    expect(api.listCalls).toBe(callsBeforeStop);
  });

  test('answers liveness pings with whether this window is enrolled', async () => {
    const port = worker.connect();
    port.send({ type: 'autoStart:ping', seq: 1 });
    expect(port.received.at(-1)).toEqual({ type: 'autoStart:pong', seq: 1, enabled: false });

    port.send(CONFIG);
    await worker.advance(0);
    port.send({ type: 'autoStart:ping', seq: 2 });
    expect(port.received.at(-1)).toEqual({ type: 'autoStart:pong', seq: 2, enabled: true });
  });

  test('acknowledges configure only to the window that sent it', async () => {
    const first = worker.connect();
    const second = worker.connect();
    first.send(CONFIG);

    expect(first.received.some((m) => m.type === 'autoStart:started')).toBe(true);
    expect(second.received.some((m) => m.type === 'autoStart:started')).toBe(false);
    await worker.advance(0);
  });
});
