/** Client for the SharedWorker background auto-start loop. */

/** @type {MessagePort | null} */
let workerPort = null;
let workerFailed = false;
let workerConfigured = false;

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

function handleWorkerMessage(event) {
  const data = event.data;
  if (!data || typeof data.type !== 'string') return;

  if (data.type === 'autoStart:result') {
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
    workerConfigured = true;
    notifyStateListeners();
    return;
  }

  if (data.type === 'autoStart:stopped') {
    workerConfigured = false;
    notifyStateListeners();
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
    workerPort = worker.port;
    workerPort.start();
    workerPort.onmessage = handleWorkerMessage;
    worker.onerror = () => {
      workerFailed = true;
      workerConfigured = false;
      workerPort = null;
      notifyStateListeners();
    };
    return workerPort;
  } catch {
    workerFailed = true;
    workerConfigured = false;
    return null;
  }
}

export function isAutoStartWorkerSupported() {
  return typeof SharedWorker !== 'undefined' && !workerFailed;
}

export function isAutoStartWorkerActive() {
  return workerConfigured && !workerFailed && workerPort != null;
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
 * @param {Object} config
 * @param {boolean} config.enabled
 * @param {string | null} config.apiKey
 * @param {number} [config.limit]
 * @param {number} [config.queuedIntervalMs]
 * @param {number} [config.watchIntervalMs]
 * @param {number} [config.betweenStartsMs]
 * @param {number} [config.processedTtlMs]
 * @returns {boolean}
 */
export function configureAutoStartWorker({
  enabled,
  apiKey,
  limit,
  queuedIntervalMs,
  watchIntervalMs,
  betweenStartsMs,
  processedTtlMs,
}) {
  const port = ensureWorkerPort();
  if (!port) {
    workerConfigured = false;
    notifyStateListeners();
    return false;
  }

  const shouldEnable = enabled === true && !!apiKey;

  port.postMessage({
    type: 'autoStart:configure',
    enabled: shouldEnable,
    apiKey: shouldEnable ? apiKey : null,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    limit,
    queuedIntervalMs,
    watchIntervalMs,
    betweenStartsMs,
    processedTtlMs,
  });

  if (!shouldEnable) {
    workerConfigured = false;
    notifyStateListeners();
    return false;
  }

  workerConfigured = true;
  notifyStateListeners();
  return true;
}

export function stopAutoStartWorker() {
  if (workerPort) {
    workerPort.postMessage({ type: 'autoStart:stop' });
  }
  workerConfigured = false;
  notifyStateListeners();
}

/** @internal — test helper */
export function resetAutoStartWorkerClientForTests() {
  workerPort = null;
  workerFailed = false;
  workerConfigured = false;
  resultListeners.clear();
  stateListeners.clear();
}
