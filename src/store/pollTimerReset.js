/** @type {(() => void) | null} */
let resetPollTimerFn = null;

export function registerPollTimerReset(fn) {
  resetPollTimerFn = fn;
}

export function unregisterPollTimerReset() {
  resetPollTimerFn = null;
}

/** Restart the poll interval from now (registered by usePollTimer). */
export function resetPollTimer() {
  resetPollTimerFn?.();
}
