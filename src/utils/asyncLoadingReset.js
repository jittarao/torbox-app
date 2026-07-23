/**
 * Clear loading/busy flags only when the request generation still matches.
 * Call from `finally` blocks so stale in-flight responses cannot clear a newer request's UI.
 */
export function resetFlagsIfRequestCurrent(requestId, currentRequestIdRef, ...setters) {
  if (requestId !== currentRequestIdRef.current) return;
  for (const setter of setters) {
    setter(false);
  }
}

/** Clear a loading flag unless the caller's abort signal has fired. */
export function resetLoadingUnlessAborted(signal, setLoading) {
  if (signal?.aborted) return;
  setLoading(false);
}

/** Clear loading when the request generation still matches and the signal is active. */
export function resetLoadingIfGenerationCurrent(
  signal,
  generation,
  currentGenerationRef,
  setLoading
) {
  if (signal?.aborted || generation !== currentGenerationRef.current) return;
  setLoading(false);
}

/** Clear loading state and optional extra busy refs unless aborted. */
export function resetBusyUnlessAborted(signal, setLoading, onReset) {
  if (signal?.aborted) return;
  setLoading(false);
  onReset?.();
}
