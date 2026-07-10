// SharedWorker: page poll timers + background auto-start loop (fetch + controlqueued).
// Keep auto-start logic in sync with src/utils/autoStartLogic.js via public/auto-start-logic.js.

importScripts('/auto-start-logic.js');

const pollTimers = new Map();
const ports = new Set();

const DEFAULT_AUTO_START = {
  enabled: false,
  apiKey: null,
  origin: null,
  limit: 3,
  queuedIntervalMs: 60_000,
  watchIntervalMs: 15 * 60_000,
  betweenStartsMs: 400,
  processedTtlMs: 90_000,
};

/** @type {typeof DEFAULT_AUTO_START & { processedIds: Map<number|string, number>, loopTimerId: number | null, running: boolean }} */
let autoStart = {
  ...DEFAULT_AUTO_START,
  processedIds: new Map(),
  loopTimerId: null,
  running: false,
};

function broadcast(message) {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch {
      // Port closed
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearPollTimer(port) {
  const id = pollTimers.get(port);
  if (id != null) {
    clearTimeout(id);
    pollTimers.delete(port);
  }
}

function clearAutoStartLoopTimer() {
  if (autoStart.loopTimerId != null) {
    clearTimeout(autoStart.loopTimerId);
    autoStart.loopTimerId = null;
  }
}

function scheduleAutoStartLoop(delayMs) {
  clearAutoStartLoopTimer();
  if (!autoStart.enabled || !autoStart.apiKey || !autoStart.origin) return;

  autoStart.loopTimerId = setTimeout(
    () => {
      autoStart.loopTimerId = null;
      runAutoStartCycle();
    },
    Math.max(0, delayMs)
  );
}

async function fetchTorrentList() {
  const response = await fetch(`${autoStart.origin}/api/torrents`, {
    headers: {
      'x-api-key': autoStart.apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`torrent fetch failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.success !== true || !Array.isArray(data.data)) {
    return [];
  }

  return data.data;
}

async function startQueuedTorrent(id) {
  const response = await fetch(`${autoStart.origin}/api/torrents/controlqueued`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': autoStart.apiKey,
    },
    body: JSON.stringify({
      queued_id: id,
      operation: 'start',
      type: 'torrent',
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // ignore parse errors
  }

  return response.ok && data.success === true;
}

async function runAutoStartCycle() {
  if (!autoStart.enabled || !autoStart.apiKey || !autoStart.origin) {
    autoStart.running = false;
    return;
  }

  if (autoStart.running) {
    scheduleAutoStartLoop(autoStart.queuedIntervalMs);
    return;
  }

  autoStart.running = true;

  let activeCount = 0;
  let queuedCount = 0;
  const startedIds = [];

  try {
    const items = await fetchTorrentList();
    const logic = self.autoStartLogic;

    logic.pruneProcessedIdsMap(autoStart.processedIds, items);

    const plan = logic.computeAutoStartPlan(
      items,
      autoStart.limit,
      autoStart.processedIds,
      Date.now(),
      autoStart.processedTtlMs
    );

    activeCount = plan.activeCount;
    queuedCount = plan.queuedCount;

    for (let i = 0; i < plan.toStart.length; i += 1) {
      const id = plan.toStart[i];
      autoStart.processedIds.set(id, Date.now());

      const ok = await startQueuedTorrent(id);
      if (ok) {
        startedIds.push(id);
      } else {
        autoStart.processedIds.delete(id);
      }

      if (i < plan.toStart.length - 1) {
        await sleep(autoStart.betweenStartsMs);
      }
    }
  } catch {
    // Keep scheduling so a transient failure does not stop the loop.
  } finally {
    autoStart.running = false;
  }

  broadcast({
    type: 'autoStart:result',
    activeCount,
    queuedCount,
    startedIds,
    at: Date.now(),
  });

  if (!autoStart.enabled) return;

  const hasQueuedWork = queuedCount > 0;
  const nextDelay = hasQueuedWork ? autoStart.queuedIntervalMs : autoStart.watchIntervalMs;
  scheduleAutoStartLoop(nextDelay);
}

function applyAutoStartConfigure(msg) {
  const enabled = msg.enabled === true && !!msg.apiKey && !!msg.origin;

  autoStart.enabled = enabled;
  autoStart.apiKey = enabled ? msg.apiKey : null;
  autoStart.origin = enabled ? msg.origin : null;
  autoStart.limit = self.autoStartLogic.coerceAutoStartLimit(msg.limit);

  if (typeof msg.queuedIntervalMs === 'number' && msg.queuedIntervalMs > 0) {
    autoStart.queuedIntervalMs = msg.queuedIntervalMs;
  }
  if (typeof msg.watchIntervalMs === 'number' && msg.watchIntervalMs > 0) {
    autoStart.watchIntervalMs = msg.watchIntervalMs;
  }
  if (typeof msg.betweenStartsMs === 'number' && msg.betweenStartsMs >= 0) {
    autoStart.betweenStartsMs = msg.betweenStartsMs;
  }
  if (typeof msg.processedTtlMs === 'number' && msg.processedTtlMs > 0) {
    autoStart.processedTtlMs = msg.processedTtlMs;
  }

  clearAutoStartLoopTimer();

  if (!enabled) {
    autoStart.processedIds.clear();
    broadcast({ type: 'autoStart:stopped', at: Date.now() });
    return;
  }

  broadcast({ type: 'autoStart:started', at: Date.now() });
  scheduleAutoStartLoop(0);
}

function stopAutoStart() {
  applyAutoStartConfigure({ enabled: false });
}

function handlePollStart(port, intervalMs) {
  clearPollTimer(port);
  const id = setTimeout(() => {
    pollTimers.delete(port);
    try {
      port.postMessage({ type: 'tick' });
    } catch {
      // Port closed
    }
  }, intervalMs);
  pollTimers.set(port, id);
}

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);
  port.start();

  port.onmessage = (event) => {
    const msg = event.data || {};

    if (msg.type === 'autoStart:configure') {
      applyAutoStartConfigure(msg);
      return;
    }

    if (msg.type === 'autoStart:stop') {
      stopAutoStart();
      return;
    }

    if (msg.type === 'poll:start' || msg.type === 'start') {
      if (typeof msg.intervalMs === 'number' && msg.intervalMs > 0) {
        handlePollStart(port, msg.intervalMs);
      }
      return;
    }

    if (msg.type === 'poll:stop' || msg.type === 'stop') {
      clearPollTimer(port);
    }
  };

  port.addEventListener('close', () => {
    ports.delete(port);
    clearPollTimer(port);
  });
};
