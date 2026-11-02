/** Client for the SharedWorker background auto-start loop. */

/** A browser can terminate a SharedWorker without any error reaching its clients. */
const DEFAULT_LIVENESS_INTERVAL_MS = 30_000;
const MISSED_PONGS_BEFORE_REPLACE = 2;
/** A ping younger than this is still in flight, so an extra check does not count it as missed. */
const PONG_GRACE_MS = 5_000;

/** @type {SharedWorker | null} */
let workerInstance = null;
/** @type {MessagePort | null} */
let workerPort = null;
let workerFailed = false;
let workerConfigured = false;

/** @type {object | null} — last configure message; null while this window does not want auto-start */
let desiredConfig = null;
let livenessIntervalMs = DEFAULT_LIVENESS_INTERVAL_MS;
/** @type {ReturnType<typeof setInterval> | null} */
let livenessTimerId = null;
let pingSeq = 0;
/** @type {number | null} */
let pendingPingSeq = null;
let pendingPingAt = 0;
let missedPongs = 0;

/** @type {{ activeCount: number, queuedCount: number } | null} */
let lastResult = null;

/** @type {Set<(result: AutoStartWorkerResult) => void>} */
const resultListeners = new Set();

/** @type {Set<() => void>} */
const stateListeners = new Set();

/**
 * @typedef {Object} AutoStartWorkerResult
 * @property {number} activeCount
 * @property {number} queuedCount
 * @property {Array<number|string>} startedIds
 * @property {number} at
 */

function notifyStateListeners() {
  for (const listener of stateListeners) {
    listener();
  }
}

function setWorkerConfigured(next) {
  if (workerConfigured === next) return;
  workerConfigured = next;
  notifyStateListeners();
}

function clearPendingPing() {
  pendingPingSeq = null;
  missedPongs = 0;
}

function sendConfigure() {
  if (workerPort && desiredConfig) {
    workerPort.postMessage(desiredConfig);
  }
}

function handleWorkerMessage(event) {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;

  if (data.type === 'autoStart:result') {
    lastResult = { activeCount: data.activeCount ?? 0, queuedCount: data.queuedCount ?? 0 };
    for (const listener of resultListeners) {
      listener({
        activeCount: data.activeCount ?? 0,
        queuedCount: data.queuedCount ?? 0,
        startedIds: Array.isArray(data.startedIds) ? data.startedIds : [],
        at: data.at ?? Date.now(),
      });
    }
    return;
  }

  if (data.type === 'autoStart:started') {
    setWorkerConfigured(desiredConfig != null);
    return;
  }

  if (data.type === 'autoStart:stopped') {
    setWorkerConfigured(false);
    return;
  }

  if (data.type === 'autoStart:pong') {
    if (data.seq !== pendingPingSeq) return;
    clearPendingPing();
    if (desiredConfig && data.enabled !== true) {
      setWorkerConfigured(false);
      sendConfigure();
    }
  }
}

function ensureWorkerPort() {
  if (workerFailed || typeof SharedWorker === 'undefined') {
    return null;
  }

  if (workerPort) {
    return workerPort;
  }

  try {
    const worker = new SharedWorker('/poll-worker.js');
    workerInstance = worker;
    workerPort = worker.port;
    workerPort.start();
    workerPort.onmessage = handleWorkerMessage;
    worker.onerror = () => {
      if (workerInstance !== worker) return;
      workerInstance = null;
      workerPort = null;
      clearPendingPing();
      setWorkerConfigured(false);
    };
    return workerPort;
  } catch {
    workerFailed = true;
    workerInstance = null;
    setWorkerConfigured(false);
    return null;
  }
}

/** Drop a worker that stopped answering. Connecting again starts a fresh instance if it died. */
function replaceWorker() {
  const stalePort = workerPort;
  workerInstance = null;
  workerPort = null;
  clearPendingPing();
  setWorkerConfigured(false);

  if (stalePort) {
    stalePort.onmessage = null;
    try {
      stalePort.postMessage({ type: 'autoStart:stop' });
      stalePort.close();
    } catch {
      // Port already gone
    }
  }

  if (ensureWorkerPort()) {
    sendConfigure();
  }
}

/**
 * Ping the worker, replacing it after repeated silence. While it is not acknowledged,
 * `isAutoStartWorkerActive()` is false and the page's own fill path takes over.
 *
 * @param {number} [now]
 */
export function checkAutoStartWorkerLiveness(now = Date.now()) {
  if (!desiredConfig) return;

  if (!workerPort) {
    if (ensureWorkerPort()) {
      sendConfigure();
    }
    return;
  }

  if (pendingPingSeq != null) {
    if (now - pendingPingAt < PONG_GRACE_MS) return;
    missedPongs += 1;
    if (missedPongs >= MISSED_PONGS_BEFORE_REPLACE) {
      replaceWorker();
      return;
    }
  }

  pingSeq += 1;
  pendingPingSeq = pingSeq;
  pendingPingAt = now;
  workerPort.postMessage({ type: 'autoStart:ping', seq: pingSeq });
}

function handleVisibilityForLiveness() {
  if (document.visibilityState === 'visible') {
    checkAutoStartWorkerLiveness();
  }
}

function startLivenessChecks() {
  stopLivenessChecks();
  livenessTimerId = setInterval(() => checkAutoStartWorkerLiveness(), livenessIntervalMs);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityForLiveness);
  }
}

function stopLivenessChecks() {
  if (livenessTimerId != null) {
    clearInterval(livenessTimerId);
    livenessTimerId = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityForLiveness);
  }
  clearPendingPing();
}

export function isAutoStartWorkerActive() {
  return workerConfigured && !workerFailed && workerPort != null;
}

/** Counts from the worker's most recent cycle, or null before the first one. */
export function getLastAutoStartResult() {
  return lastResult;
}

/**
 * @param {(result: AutoStartWorkerResult) => void} listener
 * @returns {() => void}
 */
export function subscribeAutoStartWorkerResults(listener) {
  resultListeners.add(listener);
  return () => resultListeners.delete(listener);
}

/**
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeAutoStartWorkerState(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/**
 * Takes effect once the worker acknowledges; until then the page keeps auto-start ownership.
 *
 * @param {Object} config
 * @param {boolean} config.enabled
 * @param {string | null} config.apiKey
 * @param {number} [config.limit]
 * @param {number} [config.queuedIntervalMs]
 * @param {number} [config.watchIntervalMs]
 * @param {number} [config.betweenStartsMs]
 * @param {number} [config.processedTtlMs]
 * @param {number} [config.requestTimeoutMs]
 * @param {number} [config.livenessIntervalMs]
 * @returns {boolean} whether the configuration was sent to a worker
 */
export function configureAutoStartWorker({
  enabled,
  apiKey,
  limit,
  queuedIntervalMs,
  watchIntervalMs,
  betweenStartsMs,
  processedTtlMs,
  requestTimeoutMs,
  livenessIntervalMs: nextLivenessIntervalMs,
}) {
  const shouldEnable = enabled === true && !!apiKey;
  if (!shouldEnable) {
    stopAutoStartWorker();
    return false;
  }

  desiredConfig = {
    type: 'autoStart:configure',
    enabled: true,
    apiKey,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    limit,
    queuedIntervalMs,
    watchIntervalMs,
    betweenStartsMs,
    processedTtlMs,
    requestTimeoutMs,
  };
  livenessIntervalMs = nextLivenessIntervalMs ?? DEFAULT_LIVENESS_INTERVAL_MS;

  const port = ensureWorkerPort();
  if (!port) {
    desiredConfig = null;
    setWorkerConfigured(false);
    return false;
  }

  sendConfigure();
  startLivenessChecks();
  return true;
}

export function stopAutoStartWorker() {
  desiredConfig = null;
  stopLivenessChecks();
  if (workerPort) {
    workerPort.postMessage({ type: 'autoStart:stop' });
  }
  setWorkerConfigured(false);
}

/** @internal — test helper */
export function resetAutoStartWorkerClientForTests() {
  stopLivenessChecks();
  workerInstance = null;
  workerPort = null;
  workerFailed = false;
  workerConfigured = false;
  desiredConfig = null;
  lastResult = null;
  pingSeq = 0;
  resultListeners.clear();
  stateListeners.clear();
}
